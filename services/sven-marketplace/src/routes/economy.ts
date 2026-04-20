// ---------------------------------------------------------------------------
// Economy Routes — marketplace-side analytics for admin dashboard.
// GET /economy/top-listings  — top 10 listings by revenue
// GET /economy/stats         — listing + order counts
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('marketplace-economy');

export async function registerMarketEconomyRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/economy/top-listings', async (_req, reply) => {
    try {
      const res = await pool.query(
        `SELECT id, slug, title, kind, unit_price, currency,
                total_sales, total_revenue, status
         FROM marketplace_listings
         ORDER BY total_revenue DESC NULLS LAST
         LIMIT 10`,
      );
      return res.rows.map(r => ({
        id: r.id, slug: r.slug, title: r.title,
        kind: r.kind, unitPrice: r.unit_price, currency: r.currency,
        totalSales: r.total_sales ?? 0, totalRevenue: r.total_revenue ?? '0',
        status: r.status,
      }));
    } catch (err) {
      logger.error('economy/top-listings failed', { err: (err as Error).message });
      return reply.code(500).send({ error: 'Internal error' });
    }
  });

  app.get('/economy/stats', async (_req, reply) => {
    try {
      const [listings, orders, revenue] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count FROM marketplace_listings WHERE status='published'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM marketplace_orders WHERE status IN ('paid','fulfilled')`),
        pool.query(`SELECT COALESCE(SUM(total_revenue::numeric), 0) AS total FROM marketplace_listings`),
      ]);
      return {
        publishedListings: listings.rows[0]?.count ?? 0,
        completedOrders: orders.rows[0]?.count ?? 0,
        totalMarketRevenue: Number(revenue.rows[0]?.total ?? 0),
      };
    } catch (err) {
      logger.error('economy/stats failed', { err: (err as Error).message });
      return reply.code(500).send({ error: 'Internal error' });
    }
  });
}
