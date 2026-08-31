import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const prisma = {
  order: { findMany: jest.fn(), findUnique: jest.fn() },
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('findAllForAdmin', () => {
    it('reads every order newest first and flattens the line count', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', totalAmount: 4990, _count: { items: 3 } },
      ]);

      await expect(service.findAllForAdmin()).resolves.toEqual([
        { id: 'order-1', totalAmount: 4990, itemCount: 3 },
      ]);

      const [{ where, orderBy }] = prisma.order.findMany.mock.calls[0] as [
        { where: Record<string, unknown>; orderBy: unknown },
      ];

      expect(where).toEqual({ status: undefined, OR: undefined });
      expect(orderBy).toEqual({ createdAt: 'desc' });
    });

    it('filters on the status and searches the email and the shipping name', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.findAllForAdmin(OrderStatus.PAID, '  ada  ');

      const [{ where }] = prisma.order.findMany.mock.calls[0] as [
        { where: { status: OrderStatus; OR: unknown } },
      ];

      expect(where.status).toBe(OrderStatus.PAID);
      expect(where.OR).toEqual([
        { email: { contains: 'ada', mode: 'insensitive' } },
        { shippingFirstName: { contains: 'ada', mode: 'insensitive' } },
        { shippingLastName: { contains: 'ada', mode: 'insensitive' } },
      ]);
    });

    it('treats a blank search term as no search at all', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.findAllForAdmin(undefined, '   ');

      const [{ where }] = prisma.order.findMany.mock.calls[0] as [
        { where: { OR: unknown } },
      ];

      expect(where.OR).toBeUndefined();
    });
  });

  describe('findOneForAdmin', () => {
    it('returns the order with its purchased lines', async () => {
      const order = { id: 'order-1', items: [{ id: 1, title: 'Bra' }] };
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(service.findOneForAdmin('order-1')).resolves.toBe(order);
      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1' } }),
      );
    });

    it('answers 404 for an unknown order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOneForAdmin('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
