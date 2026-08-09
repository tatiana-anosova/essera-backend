import { ApiProperty } from '@nestjs/swagger';
import { ProductLabel, ProductStatus } from '@prisma/client';
import { ProductVariantResponseDto } from './';

export class ProductResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'white-bra' })
  slug: string;

  @ApiProperty({ example: 'Where softness meets quiet confidence' })
  title: string;

  @ApiProperty({ example: 'Minimal lingerie for women who choose calm, confidence, and comfort.' })
  description: string;

  @ApiProperty({ example: 'bra' })
  category: string;

  @ApiProperty({ example: 'Essera' })
  brand: string;

  @ApiProperty({ example: 50 })
  basePrice: number;

  @ApiProperty({ example: 20, required: false })
  discount: number;

  @ApiProperty({ example: 40, required: false })
  discountPrice?: number;

  @ApiProperty({ example: 'new', enum: ProductLabel })
  label: ProductLabel;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ProductStatus,
    description: 'Only `ACTIVE` products are returned by the public endpoints.',
  })
  status: ProductStatus;

  @ApiProperty({ example: 4.8, required: false })
  rating: number;

  @ApiProperty({ example: 120, required: false })
  reviewsCount: number;

  @ApiProperty({ type: [ProductVariantResponseDto] })
  variants: ProductVariantResponseDto[];

  @ApiProperty({ example: '2025-08-01T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-08-05T14:00:00.000Z' })
  updatedAt: Date;
}
