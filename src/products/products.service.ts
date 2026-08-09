import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  CreateProductSizeDto,
  UpdateProductSizeDto,
} from './dto';

const withVariants = {
  variants: {
    include: {
      sizes: true,
    },
  },
};

/**
 * The only product columns ever written from a request body. Listing them explicitly keeps `id`,
 * `status`, `createdAt`, `updatedAt` and anything a client invents out of Prisma, which matters
 * because the global validation pipe does not whitelist. Prisma ignores an `undefined`, while an
 * explicit `null` still clears a nullable column such as `discountPrice`.
 */
const productData = (dto: CreateProductDto | UpdateProductDto) => {
  const {
    slug,
    title,
    description,
    category,
    brand,
    basePrice,
    discount,
    discountPrice,
    label,
    rating,
    reviewsCount,
  } = dto;

  return {
    slug,
    title,
    description,
    category,
    brand,
    basePrice,
    discount,
    discountPrice,
    label,
    rating,
    reviewsCount,
  };
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
      // The public details reads are gated on ACTIVE, so this is where an admin sees the details
      // of a product that is still a draft, or already archived.
      include: { ...withVariants, details: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const { variants = [] } = createProductDto;
    return this.prisma.product.create({
      data: {
        ...productData(createProductDto),
        // A product is always born as a draft; publishing is an explicit action.
        status: ProductStatus.DRAFT,
        variants: {
          create: (variants ?? []).map((variant) => ({
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
    await this.assertExists(id);

    // `variants` is deliberately not persisted here; the variant endpoints own them.
    return this.prisma.product.update({
      where: { id },
      data: productData(updateProductDto),
      include: withVariants,
    });
  }

  /**
   * The delete is conditional on the product still being a draft, so a publish that lands in
   * between rolls the whole transaction back, children included.
   */
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        include: withVariants,
      });

      if (!product) throw new NotFoundException('Product not found');

      // Variants, sizes and details reference the product, so they go first.
      await tx.productSize.deleteMany({
        where: { variant: { productId: id } },
      });
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.detail.deleteMany({ where: { productId: id } });

      const { count } = await tx.product.deleteMany({
        where: { id, status: ProductStatus.DRAFT },
      });

      if (count === 0) {
        throw new ConflictException(
          'Only draft products can be permanently deleted',
        );
      }

      return product;
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

  /**
   * The expected source status is part of the write, so two concurrent transitions cannot both
   * win: the loser updates no row and is reported as a conflict.
   */
  private async transition(
    id: number,
    from: ProductStatus,
    to: ProductStatus,
    conflict: string,
  ) {
    const { count } = await this.prisma.product.updateMany({
      where: { id, status: from },
      data: { status: to },
    });

    if (count === 0) {
      await this.assertExists(id);

      throw new ConflictException(conflict);
    }

    return this.findOneForAdmin(id);
  }

  private async assertExists(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) throw new NotFoundException('Product not found');
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

  async addDetail(
    productId: number,
    dto: { key: string; title: string; content: string },
  ) {
    return this.prisma.detail.create({
      data: {
        ...dto,
        productId,
      },
    });
  }

  async updateDetail(
    detailId: number,
    dto: { key?: string; title?: string; content?: string },
  ) {
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
