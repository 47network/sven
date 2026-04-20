import type { FastifyInstance } from 'fastify';
import type { NatsConnection } from 'nats';
import { z } from 'zod';
import type { Ledger } from '@sven/treasury';
import { createLogger } from '@sven/shared';

const logger = createLogger('treasury-txns');

const TX_KINDS = [
  'revenue', 'payout', 'transfer', 'refund', 'fee',
  'compute_cost', 'upgrade', 'donation', 'seed', 'reserve_move', 'adjustment',
] as const;

const PostSchema = z.object({
  orgId: z.string().min(1),
  accountId: z.string().min(1),
  kind: z.enum(TX_KINDS),
  amount: z.union([z.string(), z.number()]).transform(String),
  currency: z.string().default('USD'),
  source: z.string().min(1),
  sourceRef: z.string().nullable().optional(),
  description: z.string().optional(),
  approvalId: z.string().nullable().optional(),
  counterAccountId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TransferSchema = z.object({
  orgId: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(String),
  currency: z.string().default('USD'),
  kind: z.enum(TX_KINDS).default('transfer'),
  source: z.string().default('internal'),
  description: z.string().optional(),
  approvalId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try {
    nc.publish(subject, Buffer.from(JSON.stringify(payload)));
  } catch (err) {
    logger.warn('NATS publish failed', { subject, err: (err as Error).message });
  }
}

export async function registerTransactionRoutes(
  app: FastifyInstance,
  ledger: Ledger,
  nc: NatsConnection | null = null,
) {
  app.post('/credit', async (req, reply) => {
    const parsed = PostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const tx = await ledger.credit(parsed.data);
      publishNats(nc, 'sven.treasury.credit', {
        txId: tx.id, accountId: parsed.data.accountId,
        amount: parsed.data.amount, kind: parsed.data.kind,
        source: parsed.data.source, currency: parsed.data.currency,
      });
      return reply.code(201).send(tx);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message, code: (err as { code?: string }).code });
    }
  });

  app.post('/debit', async (req, reply) => {
    const parsed = PostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const tx = await ledger.debit(parsed.data);
      publishNats(nc, 'sven.treasury.debit', {
        txId: tx.id, accountId: parsed.data.accountId,
        amount: parsed.data.amount, kind: parsed.data.kind,
        source: parsed.data.source, currency: parsed.data.currency,
      });
      return reply.code(201).send(tx);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message, code: (err as { code?: string }).code });
    }
  });

  app.post('/transfer', async (req, reply) => {
    const parsed = TransferSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const out = await ledger.transfer(parsed.data);
      publishNats(nc, 'sven.treasury.credit', {
        txId: 'transfer', accountId: parsed.data.toAccountId,
        amount: parsed.data.amount, kind: 'transfer',
        source: parsed.data.source, currency: parsed.data.currency,
      });
      publishNats(nc, 'sven.treasury.debit', {
        txId: 'transfer', accountId: parsed.data.fromAccountId,
        amount: parsed.data.amount, kind: 'transfer',
        source: parsed.data.source, currency: parsed.data.currency,
      });
      return reply.code(201).send(out);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message, code: (err as { code?: string }).code });
    }
  });

  app.get<{ Querystring: { accountId?: string; orgId?: string; limit?: string } }>('/transactions', async (req, reply) => {
    if (!req.query.accountId && !req.query.orgId) return reply.code(400).send({ error: 'accountId or orgId required' });
    const orgId = req.query.orgId ?? '';
    const txs = await ledger.listTransactions(
      orgId,
      req.query.accountId,
      req.query.limit ? Number(req.query.limit) : 100,
    );
    return txs;
  });
}
