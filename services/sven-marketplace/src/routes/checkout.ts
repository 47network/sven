// ---------------------------------------------------------------------------
// Stripe Checkout — create payment sessions for marketplace orders
// ---------------------------------------------------------------------------
// When paymentMethod is 'stripe', the client calls POST /v1/market/checkout
// with an orderId. We create a Stripe Checkout Session with the order total,
// embed the orderId in metadata, and return the session URL for redirect.
//
// When the customer pays, Stripe fires checkout.session.completed → webhook.ts
// auto-settles via markOrderPaid(). Zero humans in the loop.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MarketplaceRepository } from '../repo.js';
import { createLogger } from '@sven/shared';

const logger = createLogger('marketplace-checkout');

const CheckoutBody = z.object({
  orderId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/**
 * Minimal Stripe API client — we only need checkout.sessions.create,
 * so we call the REST API directly instead of pulling in the full SDK.
 */
async function createStripeCheckoutSession(opts: {
  secretKey: string;
  orderId: string;
  amount: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('payment_method_types[0]', 'card');
  params.set('line_items[0][price_data][currency]', opts.currency.toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(opts.amount * 100)));
  params.set('line_items[0][price_data][product_data][name]', opts.productName);
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[orderId]', opts.orderId);
  params.set('metadata[source]', 'sven-marketplace');
  params.set('success_url', opts.successUrl);
  params.set('cancel_url', opts.cancelUrl);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe checkout session creation failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

const DEFAULT_SUCCESS = process.env.MARKETPLACE_CHECKOUT_SUCCESS_URL || 'https://market.sven.systems/checkout/success';
const DEFAULT_CANCEL = process.env.MARKETPLACE_CHECKOUT_CANCEL_URL || 'https://market.sven.systems/checkout/cancel';

export function registerCheckoutRoutes(
  app: FastifyInstance,
  repo: MarketplaceRepository,
) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  app.post('/v1/market/checkout', async (req, reply) => {
    if (!stripeKey) {
      return reply.status(500).send({
        success: false,
        error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' },
      });
    }

    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_BODY', message: parsed.error.message },
      });
    }

    const { orderId, successUrl, cancelUrl } = parsed.data;

    const order = await repo.getOrder(orderId);
    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order ${orderId} not found` },
      });
    }

    if (order.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Order is ${order.status}; expected pending` },
      });
    }

    if (order.paymentMethod !== 'stripe') {
      return reply.status(400).send({
        success: false,
        error: { code: 'WRONG_PAYMENT_METHOD', message: `Order uses ${order.paymentMethod}, not stripe` },
      });
    }

    try {
      const listing = await repo.getListing(order.listingId);
      const productName = listing ? listing.title : `Order ${orderId}`;

      const session = await createStripeCheckoutSession({
        secretKey: stripeKey,
        orderId,
        amount: order.total,
        currency: order.currency,
        productName,
        successUrl: successUrl || DEFAULT_SUCCESS,
        cancelUrl: cancelUrl || DEFAULT_CANCEL,
      });

      logger.info('Stripe checkout session created', {
        orderId,
        sessionId: session.id,
        amount: order.total,
      });

      return reply.send({
        success: true,
        data: {
          checkoutUrl: session.url,
          sessionId: session.id,
        },
      });
    } catch (err) {
      logger.error('Stripe checkout session creation failed', {
        orderId,
        err: (err as Error).message,
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'CHECKOUT_FAILED', message: (err as Error).message },
      });
    }
  });
}

// Export for testing
export { createStripeCheckoutSession };
