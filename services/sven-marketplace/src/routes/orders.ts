// ---------------------------------------------------------------------------
// Orders + fulfillments routes
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MarketplaceRepository } from '../repo.js';
import type { OrderStatus, PaymentMethod } from '../types.js';

const PAYMENT_METHODS: PaymentMethod[] = ['stripe', 'crypto_base', 'internal_credit'];
const ORDER_STATUSES: OrderStatus[] = ['pending','paid','fulfilled','refunded','failed','cancelled'];

const CreateOrderBody = z.object({
  listingId: z.string().min(1),
  buyerId: z.string().optional().nullable(),
  buyerEmail: z.string().email().optional().nullable(),
  quantity: z.number().int().positive().max(1000).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
  paymentRef: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const MarkPaidBody = z.object({
  paymentRef: z.string().optional().nullable(),
});

const FulfillBody = z.object({
  kind: z.string().min(1).max(60),
  payload: z.record(z.unknown()).default({}),
  status: z.enum(['delivered', 'failed']).optional(),
});

const ListQuery = z.object({
  listingId: z.string().optional(),
  buyerId: z.string().optional(),
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export function registerOrderRoutes(app: FastifyInstance, repo: MarketplaceRepository) {
  app.post('/v1/market/orders', async (req, reply) => {
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_BODY', message: parsed.error.message } });
    }
    try {
      const order = await repo.createOrder(parsed.data);
      return reply.status(201).send({ success: true, data: { order } });
    } catch (err) {
      return reply.status(400).send({ success: false, error: { code: 'ORDER_FAILED', message: (err as Error).message } });
    }
  });

  app.get('/v1/market/orders', async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_QUERY', message: parsed.error.message } });
    }
    const orders = await repo.listOrders(parsed.data);
    return reply.send({ success: true, data: { orders } });
  });

  app.get('/v1/market/orders/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const order = await repo.getOrder(id);
    if (!order) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    return reply.send({ success: true, data: { order } });
  });

  app.post('/v1/market/orders/:id/mark-paid', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = MarkPaidBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_BODY', message: parsed.error.message } });
    }
    try {
      const order = await repo.markOrderPaid(id, parsed.data.paymentRef ?? null);
      return reply.send({ success: true, data: { order } });
    } catch (err) {
      return reply.status(400).send({ success: false, error: { code: 'SETTLEMENT_FAILED', message: (err as Error).message } });
    }
  });

  app.post('/v1/market/orders/:id/fulfill', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = FulfillBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_BODY', message: parsed.error.message } });
    }
    const fulfillment = await repo.recordFulfillment({
      orderId: id,
      kind: parsed.data.kind,
      payload: parsed.data.payload,
      status: parsed.data.status,
    });
    return reply.status(201).send({ success: true, data: { fulfillment } });
  });
}
