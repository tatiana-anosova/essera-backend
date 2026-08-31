import { ApiProperty } from '@nestjs/swagger';

/**
 * A purchased line as it was bought. Every field but `productId` is the snapshot taken at
 * checkout, so the line still renders after the product is edited, archived or deleted.
 */
export class OrderItemResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({
    example: 1,
    nullable: true,
    description: 'The product bought, when it still exists.',
  })
  productId: number | null;

  @ApiProperty({ example: 34, nullable: true })
  sizeId: number | null;

  @ApiProperty({ example: 'Where softness meets quiet confidence' })
  title: string;

  @ApiProperty({ example: 'black', description: 'Variant colour' })
  variant: string;

  @ApiProperty({ example: '34B' })
  size: string;

  @ApiProperty({
    example: 4990,
    description: 'Minor units charged for one unit.',
  })
  unitPrice: number;

  @ApiProperty({ example: 2 })
  quantity: number;
}
