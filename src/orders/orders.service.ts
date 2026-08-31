import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOrderResponseDto, AdminOrderSummaryResponseDto } from './dto';

/** Read-only: an order is only ever written by the checkout flow and the Stripe webhook. */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every order, newest first, and unpaginated — the admin app sorts and paginates the list it is
   * given. The selection is explicit so a column added to `Order` later cannot start reaching the
   * admin app on its own.
   */
  async findAllForAdmin(
    status?: OrderStatus,
    search?: string,
  ): Promise<AdminOrderSummaryResponseDto[]> {
    const term = search?.trim();

    const orders = await this.prisma.order.findMany({
      where: {
        status,
        OR: term
          ? [
              { email: { contains: term, mode: 'insensitive' } },
              { shippingFirstName: { contains: term, mode: 'insensitive' } },
              { shippingLastName: { contains: term, mode: 'insensitive' } },
            ]
          : undefined,
      },
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        currency: true,
        totalAmount: true,
        paidAt: true,
        shippingFirstName: true,
        shippingLastName: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(({ _count, ...order }) => ({
      ...order,
      itemCount: _count.items,
    }));
  }

  /** One order with its purchase snapshot. */
  async findOneForAdmin(id: string): Promise<AdminOrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        currency: true,
        totalAmount: true,
        stripeSessionId: true,
        stripePaymentIntentId: true,
        paidAt: true,
        shippingCountry: true,
        shippingFirstName: true,
        shippingLastName: true,
        shippingAddress: true,
        shippingApartments: true,
        shippingCity: true,
        shippingState: true,
        shippingZip: true,
        shippingPhone: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            sizeId: true,
            title: true,
            variant: true,
            size: true,
            unitPrice: true,
            quantity: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return order;
  }
}
