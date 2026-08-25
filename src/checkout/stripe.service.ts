import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

const required = (name: string): string => {
  const value = (process.env[name] ?? '').trim();

  if (!value) throw new Error(`${name} is required for the checkout flow`);

  return value;
};

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * The only place that talks to Stripe. It owns the SDK client, the webhook
 * secret and the return URLs, so nothing else in the app reads Stripe
 * configuration or handles Stripe credentials.
 */
@Injectable()
export class StripeService {
  private readonly client: Stripe;
  private readonly webhookSecret: string;
  private readonly storefrontUrl: string;

  readonly currency: string;

  constructor() {
    this.client = new Stripe(required('STRIPE_SECRET_KEY'));
    this.webhookSecret = required('STRIPE_WEBHOOK_SECRET');
    this.storefrontUrl = withoutTrailingSlash(required('STOREFRONT_URL'));
    this.currency = (process.env.CHECKOUT_CURRENCY ?? 'usd')
      .trim()
      .toLowerCase();
  }

  /**
   * Stripe replaces `{CHECKOUT_SESSION_ID}` in the success URL, which is how the
   * storefront knows which order it just came back from. The redirect itself is
   * never treated as proof of payment — only the webhook is.
   */
  private successUrl(orderId: string) {
    return (
      process.env.CHECKOUT_SUCCESS_URL?.trim() ||
      `${this.storefrontUrl}/checkout/success?orderId=${orderId}&sessionId={CHECKOUT_SESSION_ID}`
    );
  }

  private cancelUrl(orderId: string) {
    return (
      process.env.CHECKOUT_CANCEL_URL?.trim() ||
      `${this.storefrontUrl}/checkout/cancel?orderId=${orderId}`
    );
  }

  createCheckoutSession(params: {
    orderId: string;
    email?: string;
    lineItems: { name: string; unitPrice: number; quantity: number }[];
  }): Promise<Stripe.Checkout.Session> {
    return this.client.checkout.sessions.create({
      mode: 'payment',
      // Lets Stripe drop a duplicate create if the storefront retries the request.
      client_reference_id: params.orderId,
      customer_email: params.email,
      metadata: { orderId: params.orderId },
      payment_intent_data: { metadata: { orderId: params.orderId } },
      line_items: params.lineItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: this.currency,
          unit_amount: item.unitPrice,
          product_data: { name: item.name },
        },
      })),
      success_url: this.successUrl(params.orderId),
      cancel_url: this.cancelUrl(params.orderId),
    });
  }

  /** Throws when the payload was not signed with the webhook secret. */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }
}
