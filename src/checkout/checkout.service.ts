import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import {
  CheckoutItemDto,
  CheckoutPaymentResponseDto,
  CreateCheckoutPaymentDto,
} from './dto';

/** A validated line, priced from the database. `unitPrice` is in minor units. */
interface PricedLine {
  productId: number;
  sizeId: number;
  title: string;
  variant: string;
  size: string;
  unitPrice: number;
  quantity: number;
}

/** The Stripe events this service acts on; everything else is acknowledged and ignored. */
const HANDLED_EVENTS: Record<string, OrderStatus> = {
  'checkout.session.completed': OrderStatus.PAID,
  'checkout.session.async_payment_succeeded': OrderStatus.PAID,
  'checkout.session.async_payment_failed': OrderStatus.FAILED,
  'checkout.session.expired': OrderStatus.CANCELLED,
};

const lineKey = (item: CheckoutItemDto) =>
  [item.productId, item.variant, item.size].join('|');

const toMinorUnits = (price: number) => Math.round(price * 100);

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Prices the cart against the database, records a PENDING order and opens a
   * Stripe Checkout Session for it. Nothing is charged and no stock is written
   * here — the order only becomes PAID from a verified webhook.
   */
  async createPayment(
    dto: CreateCheckoutPaymentDto,
    user?: { id: string; email?: string },
  ): Promise<CheckoutPaymentResponseDto> {
    const lines = await this.priceLines(dto.items);
    const totalAmount = lines.reduce(
      (total, line) => total + line.unitPrice * line.quantity,
      0,
    );

    const order = await this.prisma.order.create({
      data: {
        userId: user?.id,
        email: user?.email ?? dto.email,
        status: OrderStatus.PENDING,
        currency: this.stripe.currency,
        totalAmount,
        items: { create: lines },
      },
    });

    let session: Stripe.Checkout.Session;

    try {
      session = await this.stripe.createCheckoutSession({
        orderId: order.id,
        email: order.email ?? undefined,
        lineItems: lines.map((line) => ({
          name: `${line.title} — ${line.variant} / ${line.size}`,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
        })),
      });
    } catch (error) {
      // The provider error can carry request ids and account details, so it is
      // logged and never returned to the client.
      this.logger.error(
        `Stripe session creation failed for order ${order.id}: ` +
          `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      );

      await this.prisma.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING },
        data: { status: OrderStatus.FAILED },
      });

      throw new ServiceUnavailableException('Could not start the payment');
    }

    if (!session.url) {
      throw new ServiceUnavailableException('Could not start the payment');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return {
      orderId: order.id,
      sessionId: session.id,
      url: session.url,
      amount: totalAmount,
      currency: order.currency,
    };
  }

  /** Payment state of an order, for the page the buyer lands on after Stripe. */
  async getPaymentStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        currency: true,
        paidAt: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return order;
  }

  /**
   * Verifies the signature, then applies the event exactly once: the event id is
   * inserted in the same transaction as the order transition, so a redelivery
   * either finds the id taken (and is skipped) or, if the transition failed,
   * finds nothing at all and can be retried by Stripe.
   */
  async handleWebhook(payload: Buffer | undefined, signature?: string) {
    if (!payload) {
      throw new BadRequestException('Missing webhook payload');
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.constructEvent(payload, signature);
    } catch (error) {
      this.logger.warn(
        `Rejected a Stripe webhook: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new BadRequestException('Invalid Stripe signature');
    }

    const status = HANDLED_EVENTS[event.type];

    if (!status) return { received: true, handled: false };

    const session = event.data.object as Stripe.Checkout.Session;

    // A completed session can still be awaiting an asynchronous payment method.
    const resolved =
      status === OrderStatus.PAID && session.payment_status !== 'paid'
        ? OrderStatus.PENDING
        : status;

    if (resolved === OrderStatus.PENDING) {
      return { received: true, handled: false };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.stripeEvent.create({
          data: { id: event.id, type: event.type },
        });

        // Only a pending order transitions, so a duplicate event — or a late
        // expiry after a payment — can never move an order twice.
        await tx.order.updateMany({
          where: {
            stripeSessionId: session.id,
            status: OrderStatus.PENDING,
          },
          data: {
            status: resolved,
            paidAt: resolved === OrderStatus.PAID ? new Date() : null,
            stripePaymentIntentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : undefined,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { received: true, handled: false, duplicate: true };
      }

      throw error;
    }

    return { received: true, handled: true };
  }

  /**
   * Validates every requested line against the current catalogue and prices it
   * from the database. Any price or total sent by the client is ignored.
   */
  private async priceLines(items: CheckoutItemDto[]): Promise<PricedLine[]> {
    const merged = new Map<string, CheckoutItemDto>();

    for (const item of items) {
      const key = lineKey(item);
      const existing = merged.get(key);

      merged.set(
        key,
        existing
          ? { ...existing, quantity: existing.quantity + item.quantity }
          : { ...item },
      );
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
      include: { variants: { include: { sizes: true } } },
    });

    return [...merged.values()].map((item) => {
      const product = products.find(({ id }) => id === item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.status !== ProductStatus.ACTIVE) {
        throw new ConflictException(
          `"${product.title}" is not available for purchase`,
        );
      }

      const variant = product.variants.find(
        ({ color }) => color.toLowerCase() === item.variant.toLowerCase(),
      );

      if (!variant) {
        throw new NotFoundException(
          `"${product.title}" has no variant "${item.variant}"`,
        );
      }

      const size = variant.sizes.find(
        ({ size }) => size.toLowerCase() === item.size.toLowerCase(),
      );

      if (!size) {
        throw new NotFoundException(
          `"${product.title}" (${variant.color}) has no size "${item.size}"`,
        );
      }

      if (!size.inStock || size.quantity < item.quantity) {
        throw new ConflictException(
          `"${product.title}" (${variant.color} / ${size.size}) has only ${size.quantity} left`,
        );
      }

      const unitPrice = toMinorUnits(
        product.discountPrice ?? product.basePrice,
      );

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new ConflictException(
          `"${product.title}" is not available for purchase`,
        );
      }

      return {
        productId: product.id,
        sizeId: size.id,
        title: product.title,
        variant: variant.color,
        size: size.size,
        unitPrice,
        quantity: item.quantity,
      };
    });
  }
}
