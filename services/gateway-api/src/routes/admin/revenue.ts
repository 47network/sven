import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-revenue');

export function registerRevenueRoutes(app: FastifyInstance, pool: pg.Pool) {

  /* -------- Pipelines -------- */

  app.get('/revenue/pipelines', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const type = params.type;
    const status = params.status;

    let query = `SELECT id, org_id, name, type, status, config, metrics,
                        created_at, updated_at, last_revenue_at
                 FROM revenue_pipelines WHERE org_id = $1`;
    const values: unknown[] = [orgId];

    if (type) { values.push(type); query += ` AND type = $${values.length}`; }
    if (status) { values.push(status); query += ` AND status = $${values.length}`; }

    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, values);
    return reply.send({ success: true, data: { pipelines: result.rows } });
  });

  app.post('/revenue/pipelines', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const body = request.body as Record<string, unknown>;

    const name = String(body?.name || '').trim();
    const type = String(body?.type || 'custom');

    if (!name) return reply.status(400).send({ success: false, error: { code: 'MISSING_NAME', message: 'name is required' } });

    const validTypes = ['service_marketplace', 'product_deployment', 'content_creation', 'merchandise', 'custom'];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_TYPE', message: `type must be one of: ${validTypes.join(', ')}` } });
    }

    const id = `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const config = body?.config || {};

    await pool.query(
      `INSERT INTO revenue_pipelines (id, org_id, name, type, config) VALUES ($1, $2, $3, $4, $5)`,
      [id, orgId, name, type, JSON.stringify(config)],
    );

    await writeAudit(pool, orgId, userId, 'pipeline_created', 'revenue_pipeline', id, { name, type });
    logger.info('Revenue pipeline created', { orgId, id, name, type });
    return reply.status(201).send({ success: true, data: { id, name, type, status: 'draft' } });
  });

  app.patch('/revenue/pipelines/:id/activate', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const pipelineId = (request.params as any).id;

    const result = await pool.query(
      `UPDATE revenue_pipelines SET status = 'active' WHERE id = $1 AND org_id = $2 AND status IN ('draft','paused') RETURNING id, status`,
      [pipelineId, orgId],
    );

    if (result.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND_OR_WRONG_STATE' } });

    await writeAudit(pool, orgId, userId, 'pipeline_activated', 'revenue_pipeline', pipelineId, {});
    return reply.send({ success: true, data: result.rows[0] });
  });

  app.patch('/revenue/pipelines/:id/pause', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const pipelineId = (request.params as any).id;

    const result = await pool.query(
      `UPDATE revenue_pipelines SET status = 'paused' WHERE id = $1 AND org_id = $2 AND status = 'active' RETURNING id, status`,
      [pipelineId, orgId],
    );

    if (result.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND_OR_WRONG_STATE' } });
    return reply.send({ success: true, data: result.rows[0] });
  });

  /* -------- Single pipeline + embedded events -------- */

  app.get<{ Params: { id: string } }>('/revenue/pipelines/:id', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const pipelineId = (request.params as any).id;

    const pRes = await pool.query(
      `SELECT id, org_id, name, type, status, config, metrics,
              created_at, updated_at, last_revenue_at
       FROM revenue_pipelines WHERE id = $1 AND org_id = $2 LIMIT 1`,
      [pipelineId, orgId],
    );
    if (pRes.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const pipeline = pRes.rows[0];

    const eRes = await pool.query(
      `SELECT id, source, amount, fees, net_amount, currency, metadata, created_at
       FROM revenue_events WHERE pipeline_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [pipelineId],
    );

    return reply.send({ success: true, data: { ...pipeline, recentEvents: eRes.rows } });
  });

  /* -------- Seed pipeline summary -------- */

  app.get('/revenue/pipelines/seed-summary', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const seedCount = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM revenue_pipelines
       WHERE org_id = $1 AND status = 'active'
         AND config->'typeConfig'->>'seed' = 'true'`,
      [orgId],
    );

    const totalActive = await pool.query(
      `SELECT COUNT(*)::int AS n FROM revenue_pipelines WHERE org_id = $1 AND status = 'active'`,
      [orgId],
    );

    const last24h = await pool.query(
      `SELECT COALESCE(SUM(e.net_amount), 0)::numeric AS net,
              COUNT(*)::int AS events
       FROM revenue_events e
       JOIN revenue_pipelines p ON p.id = e.pipeline_id
       WHERE p.org_id = $1 AND e.created_at >= NOW() - INTERVAL '24 hours'`,
      [orgId],
    );

    const row24 = last24h.rows[0] || {};
    return reply.send({
      success: true,
      data: {
        seedPipelines: Number(seedCount.rows[0]?.n || 0),
        totalActive: Number(totalActive.rows[0]?.n || 0),
        last24hNet: Number(row24.net || 0),
        last24hEvents: Number(row24.events || 0),
      },
    });
  });

  /* -------- Revenue Events -------- */

  app.get('/revenue/events', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const pipelineId = params.pipeline_id;
    const limit = Math.min(200, Math.max(1, Number(params.limit || 50)));
    const offset = Math.max(0, Number(params.offset || 0));

    let query = `SELECT e.id, e.pipeline_id, e.source, e.amount, e.fees, e.net_amount,
                        e.currency, e.metadata, e.created_at
                 FROM revenue_events e
                 JOIN revenue_pipelines p ON p.id = e.pipeline_id
                 WHERE p.org_id = $1`;
    const values: unknown[] = [orgId];

    if (pipelineId) { values.push(pipelineId); query += ` AND e.pipeline_id = $${values.length}`; }

    query += ` ORDER BY e.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return reply.send({ success: true, data: { events: result.rows, limit, offset } });
  });

  /* -------- Service Endpoints (I.3.2) -------- */

  app.get('/revenue/services', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const result = await pool.query(
      `SELECT s.id, s.pipeline_id, s.skill_name, s.path, s.method, s.price_per_call,
              s.currency, s.rate_limit, s.is_public, s.description,
              s.total_calls, s.total_revenue, s.created_at
       FROM revenue_service_endpoints s
       JOIN revenue_pipelines p ON p.id = s.pipeline_id
       WHERE p.org_id = $1 ORDER BY s.total_revenue DESC`,
      [orgId],
    );
    return reply.send({ success: true, data: { services: result.rows } });
  });

  app.post('/revenue/services', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const body = request.body as Record<string, unknown>;

    const pipelineId = String(body?.pipeline_id || '');
    const skillName = String(body?.skill_name || '').trim();
    const path = String(body?.path || '').trim();
    const pricePerCall = Number(body?.price_per_call || 0);
    const rateLimit = Number(body?.rate_limit || 60);

    if (!pipelineId || !skillName || !path) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'pipeline_id, skill_name, path required' } });
    }

    // Verify pipeline belongs to org
    const pipe = await pool.query(`SELECT id FROM revenue_pipelines WHERE id = $1 AND org_id = $2`, [pipelineId, orgId]);
    if (pipe.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'PIPELINE_NOT_FOUND' } });

    const id = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await pool.query(
      `INSERT INTO revenue_service_endpoints (id, pipeline_id, skill_name, path, price_per_call, rate_limit, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, pipelineId, skillName, path, pricePerCall, rateLimit, String(body?.description || '')],
    );

    return reply.status(201).send({ success: true, data: { id, pipeline_id: pipelineId, skill_name: skillName, path } });
  });

  /* -------- Products (I.3.3) -------- */

  app.get('/revenue/products', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const result = await pool.query(
      `SELECT pr.id, pr.pipeline_id, pr.name, pr.url, pr.domain, pr.pricing_model,
              pr.monthly_price, pr.currency, pr.active_users, pr.mrr, pr.created_at
       FROM revenue_products pr
       JOIN revenue_pipelines p ON p.id = pr.pipeline_id
       WHERE p.org_id = $1 ORDER BY pr.mrr DESC`,
      [orgId],
    );
    return reply.send({ success: true, data: { products: result.rows } });
  });

  /* -------- Merchandise / XLVII Brand (I.3.5) -------- */

  app.get('/revenue/merch/products', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const result = await pool.query(
      `SELECT m.id, m.pipeline_id, m.name, m.category, m.sku, m.cost_price, m.sale_price,
              m.currency, m.inventory, m.total_sold, m.total_revenue, m.print_on_demand, m.created_at
       FROM revenue_merch_products m
       JOIN revenue_pipelines p ON p.id = m.pipeline_id
       WHERE p.org_id = $1 ORDER BY m.total_revenue DESC`,
      [orgId],
    );
    return reply.send({ success: true, data: { products: result.rows } });
  });

  app.get('/revenue/merch/orders', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const limit = Math.min(100, Math.max(1, Number(params.limit || 50)));
    const offset = Math.max(0, Number(params.offset || 0));

    const result = await pool.query(
      `SELECT o.id, o.product_id, o.quantity, o.unit_price, o.total_price,
              o.shipping_cost, o.platform_fee, o.net_revenue, o.customer_region,
              o.status, o.created_at
       FROM revenue_merch_orders o
       JOIN revenue_merch_products m ON m.id = o.product_id
       JOIN revenue_pipelines p ON p.id = m.pipeline_id
       WHERE p.org_id = $1 ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );
    return reply.send({ success: true, data: { orders: result.rows, limit, offset } });
  });

  /* -------- Stats -------- */

  app.get('/revenue/stats', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const pipelineStats = await pool.query(
      `SELECT type, COUNT(*)::int AS count,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int AS active
       FROM revenue_pipelines WHERE org_id = $1 GROUP BY type`,
      [orgId],
    );

    const eventStats = await pool.query(
      `SELECT SUM(e.amount)::numeric AS total_revenue,
              SUM(e.fees)::numeric AS total_fees,
              SUM(e.net_amount)::numeric AS total_net,
              COUNT(*)::int AS event_count
       FROM revenue_events e
       JOIN revenue_pipelines p ON p.id = e.pipeline_id
       WHERE p.org_id = $1`,
      [orgId],
    );

    const merchStats = await pool.query(
      `SELECT SUM(m.total_sold)::int AS total_sold, SUM(m.total_revenue)::numeric AS total_merch_revenue
       FROM revenue_merch_products m
       JOIN revenue_pipelines p ON p.id = m.pipeline_id
       WHERE p.org_id = $1`,
      [orgId],
    );

    const row = eventStats.rows[0] || {};
    const merch = merchStats.rows[0] || {};

    return reply.send({
      success: true,
      data: {
        pipelinesByType: pipelineStats.rows,
        totalRevenue: Number(row.total_revenue || 0),
        totalFees: Number(row.total_fees || 0),
        totalNet: Number(row.total_net || 0),
        eventCount: Number(row.event_count || 0),
        merchSold: Number(merch.total_sold || 0),
        merchRevenue: Number(merch.total_merch_revenue || 0),
      },
    });
  });
}

/* -------- audit helper -------- */
async function writeAudit(
  pool: pg.Pool,
  orgId: string,
  userId: string,
  eventType: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO treasury_audit_log (org_id, user_id, event_type, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, userId, eventType, resourceType, resourceId, JSON.stringify(details)],
    );
  } catch {
    logger.warn('Failed to write revenue audit log', { orgId, eventType, resourceId });
  }
}
