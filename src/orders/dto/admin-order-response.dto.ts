import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { OrderItemResponseDto } from './order-item-response.dto';

/**
 * A full order for the admin app: the payment references are ids that identify the payment in the
 * Stripe dashboard, never card data or provider credentials.
 */
export class AdminOrderResponseDto {
  @ApiProperty({ example: '0f1c9f0e-4f0e-4a1a-9b2a-8f4b9a2a1c33' })
  id: string;

  @ApiProperty({
    example: 'f7b3a5c4-1f2e-4a6b-8c9d-0e1f2a3b4c5d',
    nullable: true,
    description: 'The signed-in buyer; a guest checkout leaves it null.',
  })
  userId: string | null;

  @ApiProperty({ example: 'buyer@example.com', nullable: true })
  email: string | null;

  @ApiProperty({
    example: 'PAID',
    enum: OrderStatus,
    description: 'Payment state of the order; fulfilment is not modelled yet.',
  })
  status: OrderStatus;

  @ApiProperty({ example: 'usd' })
  currency: string;

  @ApiProperty({ example: 9980, description: 'Order total in minor units.' })
  totalAmount: number;

  @ApiProperty({ example: 'cs_test_a1b2c3', nullable: true })
  stripeSessionId: string | null;

  @ApiProperty({ example: 'pi_3Ab1c2D3', nullable: true })
  stripePaymentIntentId: string | null;

  @ApiProperty({ example: '2026-08-30T12:00:00.000Z', nullable: true })
  paidAt: Date | null;

  @ApiProperty({ example: 'United States', nullable: true })
  shippingCountry: string | null;

  @ApiProperty({ example: 'Ada', nullable: true })
  shippingFirstName: string | null;

  @ApiProperty({ example: 'Lovelace', nullable: true })
  shippingLastName: string | null;

  @ApiProperty({ example: '1 Infinite Loop', nullable: true })
  shippingAddress: string | null;

  @ApiProperty({ example: 'Apt 4', nullable: true })
  shippingApartments: string | null;

  @ApiProperty({ example: 'Cupertino', nullable: true })
  shippingCity: string | null;

  @ApiProperty({ example: 'CA', nullable: true })
  shippingState: string | null;

  @ApiProperty({ example: '95014', nullable: true })
  shippingZip: string | null;

  @ApiProperty({ example: '+1 (555) 010-1234', nullable: true })
  shippingPhone: string | null;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ example: '2026-08-30T11:59:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-30T12:00:00.000Z' })
  updatedAt: Date;
}
