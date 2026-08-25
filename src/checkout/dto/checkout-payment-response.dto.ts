import { ApiProperty } from '@nestjs/swagger';

/** Everything the storefront needs to hand the buyer over to Stripe — and nothing else. */
export class CheckoutPaymentResponseDto {
  @ApiProperty({ example: '0f1c9f0e-4f0e-4a1a-9b2a-8f4b9a2a1c33' })
  orderId: string;

  @ApiProperty({ example: 'cs_test_a1b2c3' })
  sessionId: string;

  @ApiProperty({ example: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3' })
  url: string;

  @ApiProperty({ example: 4990, description: 'Order total in minor units' })
  amount: number;

  @ApiProperty({ example: 'usd' })
  currency: string;
}
