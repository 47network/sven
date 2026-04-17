import { FastifyInstance } from 'fastify';
import pg from 'pg';

/**
 * Admin routes for autonomous-economy automatons (Batch 5).
 *
 * GET  /v1/admin/automatons            → list for the caller's org
 * GET  /v1/admin/automatons/:id        → single record
 * GET  /v1/admin/automatons/summary    → org-wide counts by status
 */
export async function registerAutomatonRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get('/automatons', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const status = String((req.query?.status as string) || '').trim();
    const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500);

    const params: unknown[] = [orgId];
    let where = 'WHERE org_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }

    const rows = await pool.query(
      `SELECT id, org_id, parent_id, status, treasury_account_id, wallet_id,
              generation, born_at, retired_at, died_at,
              pipeline_ids, metrics, metadata
       FROM automatons
       ${where}
       ORDER BY born_at DESC
       LIMIT ${limit}`,
      params,
    );

    return {
      success: true,
      data: {
        automatons: rows.rows.map((r) => ({
          id: r.id,
          orgId: r.org_id,
          parentId: r.parent_id,
          status: r.status,
          treasuryAccountId: r.treasury_account_id,
          walletId: r.wallet_id,
          generation: r.generation,
          bornAt: r.born_at,
          retiredAt: r.retired_at,
          diedAt: r.died_at,
          pipelineIds: r.pipeline_ids,
          metrics: r.metrics,
          metadata: r.metadata,
        })),
      },
    };
  });

  app.get('/automatons/summary', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const res = await pool.query(
      `SELECT status, COUNT(*)::int AS n
       FROM automatons WHERE org_id = $1
       GROUP BY status`,
      [orgId],
    );
    const counts: Record<string, number> = { born: 0, working: 0, cloning: 0, retiring: 0, dead: 0 };
    for (const row of res.rows) counts[row.status] = Number(row.n) || 0;

    const roi = await pool.query(
      `SELECT COALESCE(SUM((metrics->>'lifetimeRevenueUsd')::numeric), 0) AS revenue,
              COALESCE(SUM((metrics->>'lifetimeCostUsd')::numeric), 0) AS cost
       FROM automatons WHERE org_id = $1`,
      [orgId],
    );

    return {
      success: true,
      data: {
        counts,
        totalRevenueUsd: Number(roi.rows[0]?.revenue || 0),
        totalCostUsd: Number(roi.rows[0]?.cost || 0),
      },
    };
  });

  app.get<{ Params: { id: string } }>('/automatons/:id', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const res = await pool.query(
      `SELECT id, org_id, parent_id, status, treasury_account_id, wallet_id,
              generation, born_at, retired_at, died_at,
              pipeline_ids, metrics, metadata
       FROM automatons WHERE id = $1 AND org_id = $2 LIMIT 1`,
      [req.params.id, orgId],
    );
    const r = res.rows[0];
    if (!r) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    return {
      success: true,
      data: {
        id: r.id,
        orgId: r.org_id,
        parentId: r.parent_id,
        status: r.status,
        treasuryAccountId: r.treasury_account_id,
        walletId: r.wallet_id,
        generation: r.generation,
        bornAt: r.born_at,
        retiredAt: r.retired_at,
        diedAt: r.died_at,
        pipelineIds: r.pipeline_ids,
        metrics: r.metrics,
        metadata: r.metadata,
      },
    };
  });
}
