import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalSupabaseAuthGuard } from '../auth/optional-supabase-auth.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutPaymentResponseDto, CreateCheckoutPaymentDto } from './dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ApiOperation({
    summary: 'Start a payment for the current cart',
    description:
      'Prices the cart on the server, records a pending order and returns the Stripe ' +
      'Checkout Session to redirect to. Client-side prices and totals are ignored. ' +
      'Optionally authenticated: a bearer token links the order to the buyer.',
  })
  @ApiCreatedResponse({ type: CheckoutPaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown product, variant or size' })
  @ApiConflictResponse({
    description: 'The product is not on sale, or the stock is insufficient',
  })
  @ApiServiceUnavailableResponse({ description: 'Stripe refused the session' })
  @UseGuards(OptionalSupabaseAuthGuard)
  @Post('payment')
  createPayment(@Body() dto: CreateCheckoutPaymentDto, @Req() req: Request) {
    return this.checkoutService.createPayment(dto, req.user);
  }

  @ApiOperation({
    summary: 'Read the payment state of an order',
    description:
      'The page the buyer returns to polls this; the order only turns `PAID` from the webhook.',
  })
  @ApiOkResponse({ description: 'Order id, payment state, total and currency' })
  @ApiNotFoundResponse({ description: 'Unknown order' })
  @Get('payment/:orderId')
  getPaymentStatus(@Param('orderId') orderId: string) {
    return this.checkoutService.getPaymentStatus(orderId);
  }

  /**
   * Stripe posts here. The signature is verified against the raw body, which is
   * why the app is bootstrapped with `rawBody: true`.
   */
  @ApiExcludeEndpoint()
  @ApiBadRequestResponse({ description: 'Missing or invalid Stripe signature' })
  @HttpCode(200)
  @Post('stripe/webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.checkoutService.handleWebhook(req.rawBody, signature);
  }
}
