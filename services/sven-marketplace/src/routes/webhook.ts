// ---------------------------------------------------------------------------
// Stripe webhook handler for Sven Marketplace
// ---------------------------------------------------------------------------
// Receives Stripe events, verifies signatures, and auto-settles orders
// via the existing markOrderPaid() flow. This is the critical path for
// autonomous revenue — no human in the loop.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { MarketplaceRepository } from '../repo.js';
import { createLogger } from '@sven/shared';

const logger = createLogger('marketplace-webhook');

// ── Idempotency guard ──────────────────────────────────────────────
// Stripe may deliver the same event multiple times. We keep a bounded
// set of recently-processed event IDs to avoid double-crediting.
const PROCESSED_MAX = 5_000;
const processedEvents = new Set<string>();

function isAlreadyProcessed(eventId: string): boolean {
  if (processedEvents.has(eventId)) return true;
  if (processedEvents.size >= PROCESSED_MAX) {
    // Evict oldest entries (Set keeps insertion order)
    const iter = processedEvents.values();
    for (let i = 0; i < Math.floor(PROCESSED_MAX / 4); i++) {
      const v = iter.next().value;
      if (v !== undefined) processedEvents.delete(v);
    }
  }
  processedEvents.add(eventId);
  return false;
}

/**
 * Minimal Stripe event shape — we only read what we need instead of
 * importing the full Stripe SDK types. The signature verification is
 * done with the raw body + crypto, keeping the dependency footprint tiny.
 */
interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status?: string;
      metadata?: Record<string, string>;
      payment_intent?: string;
      amount_total?: number;
      currency?: string;
    };
  };
}

/**
 * Verify Stripe webhook signature using timing-safe comparison.
 * Implements the same algorithm as the official Stripe SDK:
 * https://stripe.com/docs/webhooks/signatures
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSec = 300,
): Promise<StripeEvent> {
  const parts = sigHeader.split(',');
  const tsEntry = parts.find((p) => p.startsWith('t='));
  const v1Entries = parts.filter((p) => p.startsWith('v1='));

  if (!tsEntry || v1Entries.length === 0) {
    throw new Error('Invalid Stripe signature header');
  }

  const timestamp = Number(tsEntry.slice(2));
  const expectedSigs = v1Entries.map((e) => e.slice(3));

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) {
    throw new Error('Stripe webhook timestamp outside tolerance');
  }

  // Compute HMAC
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const signedPayload = `${timestamp}.${payload}`;
  const expectedHmac = createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Timing-safe compare against all v1 signatures
  const match = expectedSigs.some((sig) => {
    try {
      return timingSafeEqual(
        Buffer.from(expectedHmac, 'hex'),
        Buffer.from(sig, 'hex'),
      );
    } catch {
      return false;
    }
  });

  if (!match) {
    throw new Error('Stripe webhook signature mismatch');
  }

  return JSON.parse(payload) as StripeEvent;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  repo: MarketplaceRepository,
) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  app.post('/v1/webhooks/stripe', async (req, reply) => {
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return reply.status(500).send({ error: 'webhook_not_configured' });
    }

    const sigHeader = req.headers['stripe-signature'] as string | undefined;
    if (!sigHeader) {
      return reply.status(400).send({ error: 'missing_signature' });
    }

    const rawBody = req.body as string;

    let event: StripeEvent;
    try {
      event = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    } catch (err) {
      logger.warn('Webhook signature verification failed', {
        err: (err as Error).message,
      });
      return reply.status(400).send({ error: 'invalid_signature' });
    }

    logger.info('Stripe event received', { type: event.type, id: event.id });

    // Idempotency: skip if we already processed this event
    if (isAlreadyProcessed(event.id)) {
      logger.info('Duplicate Stripe event — already processed', { id: event.id });
      return reply.status(200).send({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.payment_status === 'paid' && session.metadata?.orderId) {
          try {
            await repo.markOrderPaid(
              session.metadata.orderId,
              session.payment_intent as string ?? session.id,
            );
            logger.info('Order auto-settled via Stripe checkout', {
              orderId: session.metadata.orderId,
              paymentIntent: session.payment_intent,
            });
          } catch (err) {
            logger.error('Failed to settle order from checkout.session.completed', {
              orderId: session.metadata.orderId,
              err: (err as Error).message,
            });
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        if (pi.metadata?.orderId) {
          try {
            await repo.markOrderPaid(pi.metadata.orderId, pi.id);
            logger.info('Order auto-settled via payment_intent.succeeded', {
              orderId: pi.metadata.orderId,
              paymentIntentId: pi.id,
            });
          } catch (err) {
            logger.error('Failed to settle order from payment_intent.succeeded', {
              orderId: pi.metadata.orderId,
              err: (err as Error).message,
            });
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.metadata?.orderId) {
          logger.info('Refund received from Stripe', { orderId: charge.metadata.orderId });
          try {
            await repo.refundOrder(
              charge.metadata.orderId,
              charge.refunds?.data?.[0]?.reason ?? 'stripe_refund',
            );
          } catch (err) {
            logger.error('Refund processing failed', {
              orderId: charge.metadata.orderId,
              err: (err as Error).message,
            });
          }
        }
        break;
      }

      default:
        logger.info('Unhandled Stripe event type', { type: event.type });
    }

    // Always return 200 to Stripe so it doesn't retry
    return reply.status(200).send({ received: true });
  });
}

// Export for testing
export { verifyStripeSignature, isAlreadyProcessed, processedEvents };
export type { StripeEvent };
