import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShippingAddressDto } from './shipping-address.dto';

export const MAX_LINE_QUANTITY = 20;
export const MAX_CHECKOUT_LINES = 50;

/**
 * One requested line. Deliberately carries no price: the unit price and the
 * total are always recomputed from the database.
 */
export class CheckoutItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  productId: number;

  @ApiProperty({ example: 'black', description: 'Variant colour' })
  @IsString()
  variant: string;

  @ApiProperty({ example: '34B' })
  @IsString()
  size: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_LINE_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}

export class CreateCheckoutPaymentDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_CHECKOUT_LINES)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @ApiProperty({
    required: false,
    example: 'buyer@example.com',
    description:
      'Receipt address for a guest checkout; ignored when the request is authenticated.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    required: false,
    type: ShippingAddressDto,
    description: 'Delivery address; stored on the order for fulfilment.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shipping?: ShippingAddressDto;
}
