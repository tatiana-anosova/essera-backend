import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductSizeDto } from './create-product-size.dto';

export class UpdateProductVariantDto {
  @ApiProperty({ example: 'white', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: '#FFFFFF', required: false })
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiProperty({
    example: ['white-bra-1.jpg', 'white-bra-2.jpg'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ type: [CreateProductSizeDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductSizeDto)
  sizes?: CreateProductSizeDto[];
}
