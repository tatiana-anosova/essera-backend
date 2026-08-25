import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { CheckoutService } from './checkout.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'White bra',
  status: ProductStatus.ACTIVE,
  basePrice: 50,
  discountPrice: 39.99,
  variants: [
    {
      id: 10,
      color: 'black',
      sizes: [
        { id: 100, size: '34B', inStock: true, quantity: 3 },
        { id: 101, size: '36B', inStock: false, quantity: 0 },
      ],
    },
  ],
  ...overrides,
});

const line = (overrides: Record<string, unknown> = {}) => ({
  productId: 1,
  variant: 'black',
  size: '34B',
  quantity: 2,
  ...overrides,
});

const session = {
  id: 'cs_test_1',
  url: 'https://checkout.stripe.com/c/pay/cs_test_1',
  payment_status: 'paid',
  payment_intent: 'pi_1',
};

const duplicateKey = () =>
  new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '6.13.0',
  });

describe('CheckoutService', () => {
  let prisma: {
    product: { findMany: jest.Mock };
    order: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    stripeEvent: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let stripe: {
    currency: string;
    createCheckoutSession: jest.Mock;
    constructEvent: jest.Mock;
  };
  let service: CheckoutService;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      order: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: 'order-1', ...data }),
          ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stripeEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((run: (tx: unknown) => Promise<unknown>) =>
        run(prisma),
      ),
    };

    stripe = {
      currency: 'usd',
      createCheckoutSession: jest.fn().mockResolvedValue(session),
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: session },
      }),
    };

    service = new CheckoutService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
    );
  });

  describe('createPayment', () => {
    it('prices the order from the database and ignores anything the client sent', async () => {
      const result = await service.createPayment({
        items: [{ ...line(), price: 1, total: 1 } as never],
      });

      const [{ data }] = prisma.order.create.mock.calls[0] as [
        {
          data: {
            totalAmount: number;
            status: OrderStatus;
            items: { create: unknown[] };
          };
        },
      ];

      // 2 × the discounted 39.99, in cents — never the client's 1.
      expect(data.totalAmount).toBe(7998);
      expect(result.amount).toBe(7998);
      expect(data.status).toBe(OrderStatus.PENDING);
      expect(data.items.create).toEqual([
        {
          productId: 1,
          sizeId: 100,
          title: 'White bra',
          variant: 'black',
          size: '34B',
          unitPrice: 3999,
          quantity: 2,
        },
      ]);
    });

    it('falls back to the base price when the product is not discounted', async () => {
      prisma.product.findMany.mockResolvedValue([
        product({ discountPrice: null }),
      ]);

      const { amount } = await service.createPayment({ items: [line()] });

      expect(amount).toBe(10000);
    });

    it('sums the quantities of duplicate lines before checking the stock', async () => {
      await expect(
        service.createPayment({ items: [line(), line()] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the Stripe session and returns only what the storefront needs', async () => {
      const result = await service.createPayment({ items: [line()] });

      expect(stripe.createCheckoutSession).toHaveBeenCalledWith({
        orderId: 'order-1',
        email: undefined,
        lineItems: [
          { name: 'White bra — black / 34B', unitPrice: 3999, quantity: 2 },
        ],
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { stripeSessionId: 'cs_test_1' },
      });
      expect(result).toEqual({
        orderId: 'order-1',
        sessionId: 'cs_test_1',
        url: session.url,
        amount: 7998,
        currency: 'usd',
      });
    });

    it('links the order to the signed-in buyer', async () => {
      await service.createPayment(
        { items: [line()], email: 'guest@example.com' },
        { id: 'user-1', email: 'buyer@example.com' },
      );

      const [{ data }] = prisma.order.create.mock.calls[0] as [
        { data: { userId?: string; email?: string } },
      ];

      expect(data).toMatchObject({
        userId: 'user-1',
        email: 'buyer@example.com',
      });
    });

    it.each([ProductStatus.DRAFT, ProductStatus.ARCHIVED])(
      'refuses a %s product',
      async (status) => {
        prisma.product.findMany.mockResolvedValue([product({ status })]);

        await expect(
          service.createPayment({ items: [line()] }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.order.create).not.toHaveBeenCalled();
      },
    );

    it('refuses an unknown product', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await expect(
        service.createPayment({ items: [line()] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses an unknown variant', async () => {
      await expect(
        service.createPayment({ items: [line({ variant: 'pink' })] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses an unknown size', async () => {
      await expect(
        service.createPayment({ items: [line({ size: 'XXL' })] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a quantity above the stock', async () => {
      await expect(
        service.createPayment({ items: [line({ quantity: 4 })] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a size that is out of stock', async () => {
      await expect(
        service.createPayment({ items: [line({ size: '36B', quantity: 1 })] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('fails the order and hides the provider error when Stripe refuses', async () => {
      stripe.createCheckoutSession.mockRejectedValue(
        new Error('No such API key: sk_live_secret'),
      );

      const failure = service.createPayment({ items: [line()] });

      await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
      // The Stripe message — which can carry keys and request ids — never leaks.
      await expect(failure).rejects.toThrow('Could not start the payment');
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: OrderStatus.PENDING },
        data: { status: OrderStatus.FAILED },
      });
    });
  });

  describe('handleWebhook', () => {
    const payload = Buffer.from('{}');

    it('marks the order paid for a verified event', async () => {
      const result = await service.handleWebhook(payload, 'sig');

      expect(prisma.stripeEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_1', type: 'checkout.session.completed' },
      });

      const [{ where, data }] = prisma.order.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];

      expect(where).toEqual({
        stripeSessionId: 'cs_test_1',
        status: OrderStatus.PENDING,
      });
      expect(data).toMatchObject({
        status: OrderStatus.PAID,
        stripePaymentIntentId: 'pi_1',
      });
      expect(result).toEqual({ received: true, handled: true });
    });

    it('rejects an invalid signature without touching the order', async () => {
      stripe.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      await expect(
        service.handleWebhook(payload, 'bad-sig'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a request without a signature header', async () => {
      await expect(service.handleWebhook(payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(stripe.constructEvent).not.toHaveBeenCalled();
    });

    it('replays nothing when the same event is delivered twice', async () => {
      prisma.stripeEvent.create.mockRejectedValue(duplicateKey());

      const result = await service.handleWebhook(payload, 'sig');

      expect(result).toEqual({
        received: true,
        handled: false,
        duplicate: true,
      });
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('cancels the order when the session expires', async () => {
      stripe.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'checkout.session.expired',
        data: { object: { ...session, payment_status: 'unpaid' } },
      });

      await service.handleWebhook(payload, 'sig');

      const [{ data }] = prisma.order.updateMany.mock.calls[0] as [
        { data: { status: OrderStatus; paidAt: Date | null } },
      ];

      expect(data.status).toBe(OrderStatus.CANCELLED);
      expect(data.paidAt).toBeNull();
    });

    it('leaves the order pending while an asynchronous payment settles', async () => {
      stripe.constructEvent.mockReturnValue({
        id: 'evt_3',
        type: 'checkout.session.completed',
        data: { object: { ...session, payment_status: 'unpaid' } },
      });

      const result = await service.handleWebhook(payload, 'sig');

      expect(result).toEqual({ received: true, handled: false });
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('acknowledges an event it does not act on', async () => {
      stripe.constructEvent.mockReturnValue({
        id: 'evt_4',
        type: 'payment_intent.created',
        data: { object: {} },
      });

      expect(await service.handleWebhook(payload, 'sig')).toEqual({
        received: true,
        handled: false,
      });
      expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
    });
  });
});
