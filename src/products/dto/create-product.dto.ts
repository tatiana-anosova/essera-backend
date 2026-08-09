import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNumber, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductLabel } from '@prisma/client';
import { CreateProductVariantDto } from './';

/** `status` is deliberately absent: a created product is always a `DRAFT`. */
export class CreateProductDto {
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

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
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
  @IsOptional()
  @IsNumber()
  rating: number;

  @ApiProperty({ example: 120, required: false })
  @IsOptional()
  @IsNumber()
  reviewsCount: number;

  @ApiProperty({ type: [CreateProductVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];
}
