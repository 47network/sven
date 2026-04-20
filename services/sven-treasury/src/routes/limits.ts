import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApprovalTiers } from '@sven/treasury';

const LimitSchema = z.object({
  orgId: z.string().min(1),
  scope: z.enum(['global', 'account', 'kind']),
  scopeRef: z.string().nullable().optional(),
  currency: z.string().default('USD'),
  autoMax: z.union([z.string(), z.number()]).transform(String),
  notifyMax: z.union([z.string(), z.number()]).transform(String),
  dailyCap: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  weeklyCap: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  monthlyCap: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  setByUserId: z.string().optional(),
  setByAgent: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function registerLimitRoutes(app: FastifyInstance, tiers: ApprovalTiers) {
  app.post('/limits', async (req, reply) => {
    const parsed = LimitSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const out = await tiers.upsertLimit({
      orgId: d.orgId,
      scope: d.scope,
      scopeRef: d.scopeRef ?? null,
      currency: d.currency,
      autoMax: d.autoMax,
      notifyMax: d.notifyMax,
      dailyCap: d.dailyCap ?? null,
      weeklyCap: d.weeklyCap ?? null,
      monthlyCap: d.monthlyCap ?? null,
      setByUserId: d.setByUserId ?? null,
      setByAgent: d.setByAgent,
      notes: d.notes ?? '',
    });
    return reply.code(201).send(out);
  });

  app.get<{ Querystring: { orgId: string } }>('/limits', async (req, reply) => {
    if (!req.query.orgId) return reply.code(400).send({ error: 'orgId required' });
    return tiers.listLimits(req.query.orgId);
  });
}
