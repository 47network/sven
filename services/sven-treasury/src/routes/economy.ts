// ---------------------------------------------------------------------------
// Economy Summary Routes — aggregate analytics for the admin dashboard.
// GET /economy/summary       — totals (balance, revenue, cost, net, listing count)
// GET /economy/transactions   — recent transactions (paginated)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('economy-routes');

export async function registerEconomyRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/economy/summary', async (_req, reply) => {
    try {
      const [balRes, revRes, costRes] = await Promise.all([
        pool.query(`SELECT COALESCE(SUM(balance::numeric), 0) AS total_balance FROM treasury_accounts`),
        pool.query(`SELECT COALESCE(SUM(amount::numeric), 0) AS total_revenue FROM treasury_transactions WHERE kind IN ('revenue', 'seed')`),
        pool.query(`SELECT COALESCE(SUM(amount::numeric), 0) AS total_cost FROM treasury_transactions WHERE kind IN ('compute_cost', 'upgrade', 'fee')`),
      ]);
      const totalBalance = Number(balRes.rows[0]?.total_balance ?? 0);
      const totalRevenue = Number(revRes.rows[0]?.total_revenue ?? 0);
      const totalCost = Number(costRes.rows[0]?.total_cost ?? 0);
      return {
        totalBalance,
        totalRevenue,
        totalCost,
        netProfit: totalRevenue - totalCost,
      };
    } catch (err) {
      logger.error('economy/summary failed', { err: (err as Error).message });
      return reply.code(500).send({ error: 'Internal error' });
    }
  });

  app.get<{ Querystring: { limit?: string; offset?: string } }>('/economy/transactions', async (req, reply) => {
    try {
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const offset = Number(req.query.offset || 0);
      const res = await pool.query(
        `SELECT id, org_id, account_id, kind, amount, currency, source, source_ref, description, created_at
         FROM treasury_transactions
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      const total = await pool.query(`SELECT COUNT(*)::int AS count FROM treasury_transactions`);
      return {
        transactions: res.rows.map(r => ({
          id: r.id, orgId: r.org_id, accountId: r.account_id,
          kind: r.kind, amount: r.amount, currency: r.currency,
          source: r.source, sourceRef: r.source_ref,
          description: r.description,
          createdAt: r.created_at?.toISOString?.() ?? r.created_at,
        })),
        total: total.rows[0]?.count ?? 0,
      };
    } catch (err) {
      logger.error('economy/transactions failed', { err: (err as Error).message });
      return reply.code(500).send({ error: 'Internal error' });
    }
  });
}
