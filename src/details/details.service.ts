// details.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDetailDto, UpdateDetailDto } from './dto';

@Injectable()
export class DetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByProductId(productId: number) {
    await this.activeProduct({ id: productId });

    return this.prisma.detail.findMany({
      where: { productId },
    });
  }

  async getBySlug(slug: string) {
    const product = await this.activeProduct({ slug });

    return this.prisma.detail.findMany({
      where: { productId: product.id },
    });
  }

  /**
   * These reads are unauthenticated, so a draft or archived product is indistinguishable from
   * a missing one here, exactly as it is on the public product endpoints.
   */
  private async activeProduct(where: { id: number } | { slug: string }) {
    const product = await this.prisma.product.findFirst({
      where: { ...where, status: ProductStatus.ACTIVE },
      select: { id: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }

  async add(productId: number, dto: CreateDetailDto) {
    return this.prisma.detail.create({
      data: {
        ...dto,
        productId,
      },
    });
  }

  async update(detailId: number, dto: UpdateDetailDto) {
    return this.prisma.detail.update({
      where: { id: detailId },
      data: dto,
    });
  }

  async remove(detailId: number) {
    return this.prisma.detail.delete({
      where: { id: detailId },
    });
  }
}
