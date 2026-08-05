import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto';

const prisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productVariant: { findMany: jest.fn(), deleteMany: jest.fn() },
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

const createdWith = () => {
  const [{ data }] = prisma.product.create.mock.calls[0] as [{ data: object }];

  return data;
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
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

    it('reads a product by id only when it is active', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.findOne(1)).resolves.toEqual({ id: 1 });
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, status: ProductStatus.ACTIVE },
        }),
      );
    });

    it('reads a product by slug only when it is active', async () => {
      prisma.product.findFirst.mockResolvedValue({ slug: 'white-bra' });

      await service.findBySlug('white-bra');

      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'white-bra', status: ProductStatus.ACTIVE },
        }),
      );
    });

    it('hides a draft or archived product behind a not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findBySlug('draft')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
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

    it('reads a product of any status by id', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 1,
        status: ProductStatus.ARCHIVED,
      });

      await expect(service.findOneForAdmin(1)).resolves.toEqual({
        id: 1,
        status: ProductStatus.ARCHIVED,
      });
    });

    it('answers not found for an unknown id', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOneForAdmin(9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create and update', () => {
    it('creates a draft', async () => {
      prisma.product.create.mockResolvedValue({ id: 1 });

      await service.create(productDto as unknown as CreateProductDto);

      expect(createdWith()).toMatchObject({ status: ProductStatus.DRAFT });
    });

    it('ignores a status smuggled into the create body', async () => {
      prisma.product.create.mockResolvedValue({ id: 1 });

      await service.create({
        ...productDto,
        status: ProductStatus.ACTIVE,
      } as unknown as CreateProductDto);

      expect(createdWith()).toMatchObject({ status: ProductStatus.DRAFT });
    });

    it('ignores a status smuggled into the update body', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 1,
        status: ProductStatus.DRAFT,
      });
      prisma.product.update.mockResolvedValue({ id: 1 });

      await service.update(1, {
        ...productDto,
        status: ProductStatus.ACTIVE,
      } as unknown as UpdateProductDto);

      const [{ data }] = prisma.product.update.mock.calls[0] as [
        { data: object },
      ];
      expect(data).not.toHaveProperty('status');
      expect(data).toMatchObject({ title: 'White bra' });
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
      '$name moves $from to $to',
      async ({ name, from, to }) => {
        prisma.product.findUnique.mockResolvedValue({ status: from });
        prisma.product.update.mockResolvedValue({ id: 1, status: to });

        await service[name](1);

        expect(prisma.product.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 1 }, data: { status: to } }),
        );
      },
    );

    it.each(transitions)(
      '$name conflicts from any other status',
      async ({ name, from }) => {
        const others = Object.values(ProductStatus).filter(
          (status) => status !== from,
        );

        for (const status of others) {
          prisma.product.findUnique.mockResolvedValue({ status });

          await expect(service[name](1)).rejects.toBeInstanceOf(
            ConflictException,
          );
        }

        expect(prisma.product.update).not.toHaveBeenCalled();
      },
    );

    it('answers not found when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.publish(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes a draft along with its variants, sizes and details', async () => {
      prisma.product.findUnique.mockResolvedValue({
        status: ProductStatus.DRAFT,
      });
      prisma.productVariant.findMany.mockResolvedValue([{ id: 7 }]);
      prisma.product.delete.mockResolvedValue({ id: 1 });

      await expect(service.remove(1)).resolves.toEqual({ id: 1 });

      expect(prisma.productSize.deleteMany).toHaveBeenCalledWith({
        where: { variantId: { in: [7] } },
      });
      expect(prisma.productVariant.deleteMany).toHaveBeenCalledWith({
        where: { productId: 1 },
      });
      expect(prisma.detail.deleteMany).toHaveBeenCalledWith({
        where: { productId: 1 },
      });
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it.each([ProductStatus.ACTIVE, ProductStatus.ARCHIVED])(
      'refuses to delete a %s product',
      async (status) => {
        prisma.product.findUnique.mockResolvedValue({ status });

        await expect(service.remove(1)).rejects.toThrow(
          'Only draft products can be permanently deleted',
        );
        expect(prisma.product.delete).not.toHaveBeenCalled();
      },
    );

    it('answers not found when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
