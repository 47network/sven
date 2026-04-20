import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApprovalTiers } from '@sven/treasury';

const ClassifySchema = z.object({
  orgId: z.string().min(1),
  accountId: z.string().optional(),
  kind: z.enum([
    'revenue', 'payout', 'transfer', 'refund', 'fee',
    'compute_cost', 'upgrade', 'donation', 'seed', 'reserve_move', 'adjustment',
  ]),
  amount: z.union([z.string(), z.number()]).transform(String),
  currency: z.string().default('USD'),
});

export async function registerClassifyRoute(app: FastifyInstance, tiers: ApprovalTiers) {
  app.post('/classify', async (req, reply) => {
    const parsed = ClassifySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await tiers.classify(parsed.data);
    return result;
  });
}
