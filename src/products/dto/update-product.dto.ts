import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNumber, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { ProductLabel } from '@prisma/client';
import { Type } from 'class-transformer';
import { CreateProductVariantDto } from './';

/** `status` is deliberately absent: it changes through publish, archive and restore. */
export class UpdateProductDto {

  @ApiProperty({ example: 'white-bra' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Where softness meets quiet confidence' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Minimal lingerie for women who choose calm, confidence, and comfort.' })
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

  @ApiProperty({ type: [CreateProductVariantDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}
