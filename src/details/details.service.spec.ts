import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DetailsService } from './details.service';

interface ProductWhere {
  id?: number;
  slug?: string;
  status?: ProductStatus;
}

const prisma = {
  product: { findFirst: jest.fn() },
  detail: { findMany: jest.fn() },
};

/** Stands in for a single stored product, so the status filter decides the answer. */
const store = (status: ProductStatus) =>
  prisma.product.findFirst.mockImplementation(
    ({ where }: { where: ProductWhere }) =>
      Promise.resolve(
        (where.id === 1 || where.slug === 'white-bra') &&
          where.status === status
          ? { id: 1 }
          : null,
      ),
  );

describe('DetailsService', () => {
  let service: DetailsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.detail.findMany.mockResolvedValue([{ id: 5, key: 'fabric' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [DetailsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DetailsService);
  });

  describe('an active product', () => {
    beforeEach(() => store(ProductStatus.ACTIVE));

    it('serves its details by product id', async () => {
      await expect(service.getByProductId(1)).resolves.toEqual([
        { id: 5, key: 'fabric' },
      ]);

      expect(prisma.detail.findMany).toHaveBeenCalledWith({
        where: { productId: 1 },
      });
    });

    it('serves its details by slug', async () => {
      await expect(service.getBySlug('white-bra')).resolves.toEqual([
        { id: 5, key: 'fabric' },
      ]);

      expect(prisma.detail.findMany).toHaveBeenCalledWith({
        where: { productId: 1 },
      });
    });
  });

  describe.each([ProductStatus.DRAFT, ProductStatus.ARCHIVED])(
    'a %s product',
    (status) => {
      beforeEach(() => store(status));

      it('is not found by product id, and no detail is read', async () => {
        await expect(service.getByProductId(1)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(prisma.detail.findMany).not.toHaveBeenCalled();
      });

      it('is not found by slug, and no detail is read', async () => {
        await expect(service.getBySlug('white-bra')).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(prisma.detail.findMany).not.toHaveBeenCalled();
      });
    },
  );

  it('is not found when the product does not exist at all', async () => {
    store(ProductStatus.ACTIVE);

    await expect(service.getByProductId(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
