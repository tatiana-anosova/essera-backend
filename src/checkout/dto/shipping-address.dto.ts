import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

const FIELD = { min: 1, max: 120 } as const;

/**
 * Where the order is to be delivered, as typed by the buyer. It is stored on the
 * order for fulfilment; nothing here influences pricing.
 */
export class ShippingAddressDto {
  @ApiProperty({ example: 'United States' })
  @IsString()
  @Length(FIELD.min, FIELD.max)
  country: string;

  @ApiProperty({ example: 'Ada' })
  @IsString()
  @Length(FIELD.min, FIELD.max)
  firstName: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @Length(FIELD.min, FIELD.max)
  lastName: string;

  @ApiProperty({ example: '1 Infinite Loop' })
  @IsString()
  @Length(FIELD.min, 240)
  address: string;

  @ApiProperty({ required: false, example: 'Apt 4' })
  @IsOptional()
  @IsString()
  @Length(0, FIELD.max)
  apartments?: string;

  @ApiProperty({ example: 'Cupertino' })
  @IsString()
  @Length(FIELD.min, FIELD.max)
  city: string;

  @ApiProperty({ example: 'CA' })
  @IsString()
  @Length(FIELD.min, FIELD.max)
  state: string;

  @ApiProperty({ example: '95014' })
  @IsString()
  @Length(FIELD.min, 32)
  zip: string;

  @ApiProperty({ example: '+1 (555) 010-1234' })
  @IsString()
  @Length(FIELD.min, 32)
  phone: string;
}
