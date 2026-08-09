import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNumber, IsOptional } from 'class-validator';
import { ProductLabel } from '@prisma/client';

/**
 * `status` is deliberately absent: it changes through publish, archive and restore. So are
 * `variants`, which are managed through the variant and size endpoints only.
 */
export class UpdateProductDto {
  @ApiProperty({ example: 'white-bra' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Where softness meets quiet confidence' })
  @IsString()
  title: string;

  @ApiProperty({
    example:
      'Minimal lingerie for women who choose calm, confidence, and comfort.',
  })
  @IsString()
  description: string;

  @ApiProperty({ example: 'bra' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'Essera' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  basePrice: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  discount: number;

  @ApiProperty({ example: 40, required: false })
  @IsOptional()
  @IsNumber()
  discountPrice?: number;

  @ApiProperty({ example: 'new', enum: ProductLabel })
  @IsEnum(ProductLabel)
  label: ProductLabel;

  @ApiProperty({ example: 4.8, required: false })
  @IsNumber()
  rating: number;

  @ApiProperty({ example: 120, required: false })
  @IsNumber()
  reviewsCount: number;
}
