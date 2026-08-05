import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, CreateProductVariantDto, UpdateProductVariantDto, CreateProductSizeDto, UpdateProductSizeDto } from './dto';

const withVariants = {
  variants: {
    include: {
      sizes: true,
    },
  },
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // PUBLIC READS — the storefront only ever sees published products.
  async findAll() {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: withVariants,
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: ProductStatus.ACTIVE },
      include: withVariants,
    });

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: withVariants,
    });

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  // ADMIN READS — every status is visible.
  async findAllForAdmin(status?: ProductStatus) {
    return this.prisma.product.findMany({
      where: status ? { status } : undefined,
      include: withVariants,
    });
  }

  async findOneForAdmin(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: withVariants,
    });

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const { variants = [], ...rest } = createProductDto;
    return this.prisma.product.create({
      data: {
        ...this.withoutStatus(rest),
        // A product is always born as a draft; publishing is an explicit action.
        status: ProductStatus.DRAFT,
        variants: {
          create: (variants ?? []).map( variant => ({
            ...variant,
            sizes: {
              create: variant.sizes,
            },
          })),
        },
      },
      include: withVariants,
    });
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    await this.findOneForAdmin(id);

    const { variants, ...rest } = updateProductDto;

    // If there are no variants — just update product
    return this.prisma.product.update({
      where: { id },
      data: this.withoutStatus(rest),
      include: withVariants,
    });
  }

  async remove(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.DRAFT) {
      throw new ConflictException(
        'Only draft products can be permanently deleted',
      );
    }

    // Variants, sizes and details reference the product, so they go first.
    return this.prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true },
      });

      await tx.productSize.deleteMany({
        where: { variantId: { in: variants.map((variant) => variant.id) } },
      });
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.detail.deleteMany({ where: { productId: id } });

      return tx.product.delete({ where: { id } });
    });
  }

  publish(id: number) {
    return this.transition(
      id,
      ProductStatus.DRAFT,
      ProductStatus.ACTIVE,
      'Only draft products can be published',
    );
  }

  archive(id: number) {
    return this.transition(
      id,
      ProductStatus.ACTIVE,
      ProductStatus.ARCHIVED,
      'Only active products can be archived',
    );
  }

  restore(id: number) {
    return this.transition(
      id,
      ProductStatus.ARCHIVED,
      ProductStatus.ACTIVE,
      'Only archived products can be restored',
    );
  }

  private async transition(
    id: number,
    from: ProductStatus,
    to: ProductStatus,
    conflict: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== from) throw new ConflictException(conflict);

    return this.prisma.product.update({
      where: { id },
      data: { status: to },
      include: withVariants,
    });
  }

  /**
   * The create and update DTOs carry no `status`, and the global validation pipe does not
   * whitelist, so an unexpected one is dropped here rather than reaching the database.
   */
  private withoutStatus<T extends object>(data: T): Omit<T, 'status'> {
    const rest = { ...data } as T & { status?: unknown };
    delete rest.status;

    return rest;
  }

  // VARIANTS
  async addVariant(productId: number, dto: CreateProductVariantDto) {
    return this.prisma.productVariant.create({
      data: {
        ...dto,
        productId,
        sizes: {
          create: dto.sizes,
        },
      },
      include: { sizes: true },
    });
  }

  async updateVariant(variantId: number, dto: UpdateProductVariantDto) {
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...dto,
        sizes: dto.sizes
          ? {
              deleteMany: {},
              create: dto.sizes,
            }
          : undefined,
      },
      include: { sizes: true },
    });
  }

  // SIZES
  async addSize(variantId: number, dto: CreateProductSizeDto) {
    return this.prisma.productSize.create({
      data: {
        ...dto,
        variantId,
      },
    });
  }

  async updateSize(sizeId: number, dto: UpdateProductSizeDto) {
    return this.prisma.productSize.update({
      where: { id: sizeId },
      data: dto,
    });
  }

  // DETAILS
  async getDetailsByProductId(productId: number) {
    return this.prisma.detail.findMany({
      where: { productId },
    });
  }

  async getDetailsByProductSlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.detail.findMany({
      where: { productId: product.id },
    });
  }

  async addDetail(productId: number, dto: { key: string; title: string; content: string }) {
    return this.prisma.detail.create({
      data: {
        ...dto,
        productId,
      },
    });
  }

  async updateDetail(detailId: number, dto: { key?: string; title?: string; content?: string }) {
    return this.prisma.detail.update({
      where: { id: detailId },
      data: dto,
    });
  }

  async removeDetail(detailId: number) {
    return this.prisma.detail.delete({
      where: { id: detailId },
    });
  }
}
