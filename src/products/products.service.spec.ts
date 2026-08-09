import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto';

interface StatusWhere {
  id?: number;
  slug?: string;
  status?: ProductStatus;
}

/** The single product the fake Prisma below holds; `null` means it is gone. */
let stored: ProductStatus | null = ProductStatus.DRAFT;

const matches = (where: StatusWhere) =>
  stored !== null &&
  (where.id === undefined || where.id === 1) &&
  (where.slug === undefined || where.slug === 'white-bra') &&
  (where.status === undefined || where.status === stored);

const found = () => ({ id: 1, slug: 'white-bra', status: stored });

const prisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(({ where }: { where: StatusWhere }) =>
      Promise.resolve(matches(where) ? found() : null),
    ),
    findUnique: jest.fn(({ where }: { where: StatusWhere }) =>
      Promise.resolve(matches(where) ? found() : null),
    ),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: StatusWhere;
        data: { status: ProductStatus };
      }) => {
        if (!matches(where)) return Promise.resolve({ count: 0 });

        stored = data.status;

        return Promise.resolve({ count: 1 });
      },
    ),
    deleteMany: jest.fn(({ where }: { where: StatusWhere }) => {
      if (!matches(where)) return Promise.resolve({ count: 0 });

      stored = null;

      return Promise.resolve({ count: 1 });
    }),
  },
  productVariant: { deleteMany: jest.fn() },
  productSize: { deleteMany: jest.fn() },
  detail: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

const productDto = {
  slug: 'white-bra',
  title: 'White bra',
  description: '',
  category: 'bra',
  brand: 'Essera',
  basePrice: 50,
  discount: 0,
  label: 'new',
  rating: 4.8,
  reviewsCount: 12,
  variants: [],
};

const dataOf = (mock: jest.Mock) => {
  const [{ data }] = mock.mock.calls[0] as [{ data: Record<string, unknown> }];

  return data;
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    stored = ProductStatus.DRAFT;
    prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('public reads', () => {
    it('lists only active products', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ProductStatus.ACTIVE } }),
      );
    });

    it('reads an active product by id and by slug', async () => {
      stored = ProductStatus.ACTIVE;

      await expect(service.findOne(1)).resolves.toMatchObject({ id: 1 });
      await expect(service.findBySlug('white-bra')).resolves.toMatchObject({
        id: 1,
      });
    });

    it.each([ProductStatus.DRAFT, ProductStatus.ARCHIVED])(
      'hides a %s product behind a not found, by id and by slug',
      async (status) => {
        stored = status;

        await expect(service.findOne(1)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(service.findBySlug('white-bra')).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );
  });

  describe('admin reads', () => {
    it('lists products of every status', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findAllForAdmin();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('filters by the requested status', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findAllForAdmin(ProductStatus.DRAFT);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ProductStatus.DRAFT } }),
      );
    });

    it.each(Object.values(ProductStatus))(
      'reads a %s product by id',
      async (status) => {
        stored = status;

        await expect(service.findOneForAdmin(1)).resolves.toMatchObject({
          status,
        });
      },
    );

    it('reads the details along with a product of any status', async () => {
      stored = ProductStatus.DRAFT;

      await service.findOneForAdmin(1);

      const [{ include }] = prisma.product.findUnique.mock
        .calls[0] as unknown[] as [{ include: Record<string, unknown> }];
      expect(include).toMatchObject({ details: true });
    });

    it('answers not found for an unknown id', async () => {
      stored = null;

      await expect(service.findOneForAdmin(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create and update', () => {
    const smuggled = {
      ...productDto,
      id: 99,
      status: ProductStatus.ACTIVE,
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
      nonsense: true,
    };

    it('creates a draft', async () => {
      prisma.product.create.mockResolvedValue({ id: 1 });

      await service.create(productDto as unknown as CreateProductDto);

      expect(dataOf(prisma.product.create)).toMatchObject({
        status: ProductStatus.DRAFT,
        title: 'White bra',
      });
    });

    it('writes only allowlisted columns on create', async () => {
      prisma.product.create.mockResolvedValue({ id: 1 });

      await service.create(smuggled as unknown as CreateProductDto);

      const data = dataOf(prisma.product.create);
      expect(data.status).toBe(ProductStatus.DRAFT);
      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('createdAt');
      expect(data).not.toHaveProperty('updatedAt');
      expect(data).not.toHaveProperty('nonsense');
    });

    it('writes only allowlisted columns on update', async () => {
      prisma.product.update.mockResolvedValue({ id: 1 });

      await service.update(1, smuggled as unknown as UpdateProductDto);

      const data = dataOf(prisma.product.update);
      expect(data).toMatchObject({ title: 'White bra' });
      expect(data).not.toHaveProperty('status');
      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('createdAt');
      expect(data).not.toHaveProperty('updatedAt');
      expect(data).not.toHaveProperty('nonsense');
      expect(data).not.toHaveProperty('variants');
    });

    it('clears a nullable column when the body says null', async () => {
      prisma.product.update.mockResolvedValue({ id: 1 });

      await service.update(1, {
        ...productDto,
        discountPrice: null,
      } as unknown as UpdateProductDto);

      expect(dataOf(prisma.product.update)).toHaveProperty(
        'discountPrice',
        null,
      );
    });

    it('answers not found when updating an unknown product', async () => {
      stored = null;

      await expect(
        service.update(1, productDto as unknown as UpdateProductDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('transitions', () => {
    const transitions = [
      { name: 'publish', from: ProductStatus.DRAFT, to: ProductStatus.ACTIVE },
      {
        name: 'archive',
        from: ProductStatus.ACTIVE,
        to: ProductStatus.ARCHIVED,
      },
      {
        name: 'restore',
        from: ProductStatus.ARCHIVED,
        to: ProductStatus.ACTIVE,
      },
    ] as const;

    it.each(transitions)(
      '$name moves $from to $to, asserting the source status in the write',
      async ({ name, from, to }) => {
        stored = from;

        await expect(service[name](1)).resolves.toMatchObject({ status: to });

        expect(prisma.product.updateMany).toHaveBeenCalledWith({
          where: { id: 1, status: from },
          data: { status: to },
        });
        expect(stored).toBe(to);
      },
    );

    it.each(transitions)(
      '$name conflicts from any other status, leaving it untouched',
      async ({ name, from }) => {
        const others = Object.values(ProductStatus).filter(
          (status) => status !== from,
        );

        for (const status of others) {
          stored = status;

          await expect(service[name](1)).rejects.toBeInstanceOf(
            ConflictException,
          );
          expect(stored).toBe(status);
        }
      },
    );

    it('lets only one of two concurrent publishes win', async () => {
      stored = ProductStatus.DRAFT;

      const results = await Promise.allSettled([
        service.publish(1),
        service.publish(1),
      ]);

      expect(results.map(({ status }) => status)).toEqual(
        expect.arrayContaining(['fulfilled', 'rejected']),
      );
      expect(stored).toBe(ProductStatus.ACTIVE);
    });

    it('answers not found when the product does not exist', async () => {
      stored = null;

      await expect(service.publish(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes a draft along with its variants, sizes and details', async () => {
      stored = ProductStatus.DRAFT;

      await expect(service.remove(1)).resolves.toMatchObject({ id: 1 });

      expect(prisma.productSize.deleteMany).toHaveBeenCalledWith({
        where: { variant: { productId: 1 } },
      });
      expect(prisma.productVariant.deleteMany).toHaveBeenCalledWith({
        where: { productId: 1 },
      });
      expect(prisma.detail.deleteMany).toHaveBeenCalledWith({
        where: { productId: 1 },
      });
      expect(prisma.product.deleteMany).toHaveBeenCalledWith({
        where: { id: 1, status: ProductStatus.DRAFT },
      });
      expect(stored).toBeNull();
    });

    it.each([ProductStatus.ACTIVE, ProductStatus.ARCHIVED])(
      'refuses to delete a %s product',
      async (status) => {
        stored = status;

        await expect(service.remove(1)).rejects.toThrow(
          'Only draft products can be permanently deleted',
        );
        expect(stored).toBe(status);
      },
    );

    it('conflicts when the product is published while it is being deleted', async () => {
      stored = ProductStatus.DRAFT;

      // Stands in for a publish committing between the read and the conditional delete.
      prisma.detail.deleteMany.mockImplementationOnce(() => {
        stored = ProductStatus.ACTIVE;

        return Promise.resolve({ count: 0 });
      });

      await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
      expect(stored).toBe(ProductStatus.ACTIVE);
    });

    it('answers not found when the product does not exist', async () => {
      stored = null;

      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
