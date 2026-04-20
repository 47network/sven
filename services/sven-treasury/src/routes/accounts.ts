import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ledger } from '@sven/treasury';

const CreateAccountSchema = z.object({
  orgId: z.string().min(1),
  kind: z.enum(['operating', 'reserve', 'compute', 'upgrade', 'escrow', 'external']),
  name: z.string().min(1),
  currency: z.string().default('USD'),
  walletId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function registerAccountRoutes(app: FastifyInstance, ledger: Ledger) {
  app.post('/accounts', async (req, reply) => {
    const parsed = CreateAccountSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const acct = await ledger.createAccount(parsed.data);
    return reply.code(201).send(acct);
  });

  app.get<{ Querystring: { orgId: string; kind?: string } }>('/accounts', async (req, reply) => {
    if (!req.query.orgId) return reply.code(400).send({ error: 'orgId required' });
    const list = await ledger.listAccounts(req.query.orgId, req.query.kind as never);
    return list;
  });

  app.get<{ Params: { id: string } }>('/accounts/:id', async (req, reply) => {
    const acct = await ledger.getAccount(req.params.id);
    if (!acct) return reply.code(404).send({ error: 'not_found' });
    return acct;
  });

  app.post<{ Params: { id: string }; Body: { frozen: boolean } }>('/accounts/:id/freeze', async (req, reply) => {
    const frozen = Boolean(req.body?.frozen);
    await ledger.setFrozen(req.params.id, frozen);
    return reply.send({ ok: true, id: req.params.id, frozen });
  });
}
