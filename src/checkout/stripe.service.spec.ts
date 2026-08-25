const create = jest.fn().mockResolvedValue({ id: 'cs_test_1' });
const constructEvent = jest.fn().mockReturnValue({ id: 'evt_1' });

jest.mock('stripe', () => ({
  __esModule: true,
  // The SDK is never reached over the network in tests.
  default: jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create } },
    webhooks: { constructEvent },
  })),
}));

import { StripeService } from './stripe.service';

const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
  STOREFRONT_URL: 'https://essera.example.com/',
};

describe('StripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, ENV);
    delete process.env.CHECKOUT_SUCCESS_URL;
    delete process.env.CHECKOUT_CANCEL_URL;
  });

  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key];
  });

  it.each(Object.keys(ENV))('refuses to start without %s', (key) => {
    delete process.env[key];

    expect(() => new StripeService()).toThrow(key);
  });

  it('builds the session with the configured storefront return URLs', async () => {
    await new StripeService().createCheckoutSession({
      orderId: 'order-1',
      email: 'buyer@example.com',
      lineItems: [
        { name: 'White bra — black / 34B', unitPrice: 3999, quantity: 2 },
      ],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: 'order-1',
        customer_email: 'buyer@example.com',
        metadata: { orderId: 'order-1' },
        line_items: [
          {
            quantity: 2,
            price_data: {
              currency: 'usd',
              unit_amount: 3999,
              product_data: { name: 'White bra — black / 34B' },
            },
          },
        ],
        success_url:
          'https://essera.example.com/checkout/success?orderId=order-1&sessionId={CHECKOUT_SESSION_ID}',
        cancel_url:
          'https://essera.example.com/checkout/cancel?orderId=order-1',
      }),
    );
  });

  it('verifies the payload against the webhook secret', () => {
    const payload = Buffer.from('{"id":"evt_1"}');

    new StripeService().constructEvent(payload, 'sig');

    expect(constructEvent).toHaveBeenCalledWith(payload, 'sig', 'whsec_123');
  });
});
