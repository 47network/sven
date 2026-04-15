import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-infra');

export function registerInfraRoutes(app: FastifyInstance, pool: pg.Pool) {

  /* -------- Nodes -------- */

  app.get('/infra/nodes', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const status = params.status;

    let query = `SELECT id, org_id, hostname, domain, provider, region, status,
                        resources, costs, services, tags, created_at, updated_at, last_health_check
                 FROM infra_nodes WHERE org_id = $1`;
    const values: unknown[] = [orgId];

    if (status) { values.push(status); query += ` AND status = $${values.length}`; }

    query += ` ORDER BY hostname`;
    const result = await pool.query(query, values);
    return reply.send({ success: true, data: { nodes: result.rows } });
  });

  app.post('/infra/nodes', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const body = request.body as Record<string, unknown>;

    const hostname = String(body?.hostname || '').trim();
    const domain = String(body?.domain || '').trim();
    const provider = String(body?.provider || '').trim();
    const region = String(body?.region || '').trim();

    if (!hostname) return reply.status(400).send({ success: false, error: { code: 'MISSING_HOSTNAME', message: 'hostname is required' } });
    if (!domain) return reply.status(400).send({ success: false, error: { code: 'MISSING_DOMAIN', message: 'domain is required' } });
    if (!provider) return reply.status(400).send({ success: false, error: { code: 'MISSING_PROVIDER', message: 'provider is required' } });

    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resources = body?.resources || {};
    const costs = body?.costs || {};
    const services = Array.isArray(body?.services) ? body.services : [];
    const tags = Array.isArray(body?.tags) ? body.tags : [];

    await pool.query(
      `INSERT INTO infra_nodes (id, org_id, hostname, domain, provider, region, resources, costs, services, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, orgId, hostname, domain, provider, region, JSON.stringify(resources), JSON.stringify(costs), services, tags],
    );

    await writeAudit(pool, orgId, userId, 'node_registered', 'infra_node', id, { hostname, domain, provider, region });
    logger.info('Infra node registered', { orgId, id, hostname, domain });
    return reply.status(201).send({ success: true, data: { id, hostname, domain, provider, region, status: 'provisioning' } });
  });

  app.patch('/infra/nodes/:id/status', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const nodeId = (request.params as any).id;
    const body = request.body as Record<string, unknown>;
    const status = String(body?.status || '');

    const validStatuses = ['healthy', 'degraded', 'down', 'maintenance', 'provisioning'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_STATUS', message: `status must be one of: ${validStatuses.join(', ')}` } });
    }

    const result = await pool.query(
      `UPDATE infra_nodes SET status = $1 WHERE id = $2 AND org_id = $3 RETURNING id, status`,
      [status, nodeId, orgId],
    );

    if (result.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    await writeAudit(pool, orgId, userId, 'node_status_changed', 'infra_node', nodeId, { status });
    return reply.send({ success: true, data: result.rows[0] });
  });

  /* -------- Health Checks -------- */

  app.get('/infra/nodes/:id/health', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const nodeId = (request.params as any).id;
    const params = request.query as Record<string, string>;
    const limit = Math.min(200, Math.max(1, Number(params.limit || 50)));

    // Verify node belongs to org
    const node = await pool.query(`SELECT id FROM infra_nodes WHERE id = $1 AND org_id = $2`, [nodeId, orgId]);
    if (node.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const result = await pool.query(
      `SELECT node_id, timestamp, status, latency_ms, services, resources
       FROM infra_health_log WHERE node_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [nodeId, limit],
    );
    return reply.send({ success: true, data: { checks: result.rows } });
  });

  /* -------- Proposals -------- */

  app.get('/infra/proposals', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const status = params.status;

    let query = `SELECT id, org_id, title, description, node_id, proposal_type,
                        current_cost, proposed_cost, cost_delta, expected_benefit,
                        risk_level, status, approved_by, execution_log,
                        created_at, resolved_at
                 FROM infra_proposals WHERE org_id = $1`;
    const values: unknown[] = [orgId];

    if (status) { values.push(status); query += ` AND status = $${values.length}`; }

    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, values);
    return reply.send({ success: true, data: { proposals: result.rows } });
  });

  app.post('/infra/proposals', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const body = request.body as Record<string, unknown>;

    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const proposalType = String(body?.proposal_type || '');
    const currentCost = Number(body?.current_cost || 0);
    const proposedCost = Number(body?.proposed_cost || 0);
    const expectedBenefit = String(body?.expected_benefit || '');
    const riskLevel = String(body?.risk_level || 'low');

    if (!title) return reply.status(400).send({ success: false, error: { code: 'MISSING_TITLE', message: 'title is required' } });

    const validTypes = ['scale_up', 'scale_down', 'migrate', 'new_node', 'decommission', 'optimize'];
    if (!validTypes.includes(proposalType)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_TYPE', message: `proposal_type must be one of: ${validTypes.join(', ')}` } });
    }

    const validRisks = ['low', 'medium', 'high'];
    if (!validRisks.includes(riskLevel)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_RISK', message: `risk_level must be: ${validRisks.join(', ')}` } });
    }

    const id = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const costDelta = proposedCost - currentCost;

    await pool.query(
      `INSERT INTO infra_proposals (id, org_id, title, description, node_id, proposal_type,
                                    current_cost, proposed_cost, cost_delta, expected_benefit, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, orgId, title, description, body?.node_id || null, proposalType,
       currentCost, proposedCost, costDelta, expectedBenefit, riskLevel],
    );

    await writeAudit(pool, orgId, userId, 'proposal_created', 'infra_proposal', id, { title, proposalType, costDelta });
    logger.info('Infra proposal created', { orgId, id, title, proposalType });
    return reply.status(201).send({ success: true, data: { id, title, proposal_type: proposalType, cost_delta: costDelta, status: 'draft' } });
  });

  app.post('/infra/proposals/:id/approve', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const proposalId = (request.params as any).id;

    const result = await pool.query(
      `UPDATE infra_proposals SET status = 'approved', approved_by = $1
       WHERE id = $2 AND org_id = $3 AND status = 'pending_approval'
       RETURNING id, status, approved_by`,
      [userId, proposalId, orgId],
    );

    if (result.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND_OR_WRONG_STATE' } });

    await writeAudit(pool, orgId, userId, 'proposal_approved', 'infra_proposal', proposalId, {});
    return reply.send({ success: true, data: result.rows[0] });
  });

  /* -------- Deployments -------- */

  app.get('/infra/deployments', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const nodeId = params.node_id;
    const status = params.status;

    let query = `SELECT d.id, d.node_id, d.service_name, d.version, d.image, d.status,
                        d.port, d.health_endpoint, d.cpu_limit, d.memory_limit,
                        d.replicas, d.created_at, d.updated_at
                 FROM infra_deployments d
                 JOIN infra_nodes n ON n.id = d.node_id
                 WHERE n.org_id = $1`;
    const values: unknown[] = [orgId];

    if (nodeId) { values.push(nodeId); query += ` AND d.node_id = $${values.length}`; }
    if (status) { values.push(status); query += ` AND d.status = $${values.length}`; }

    query += ` ORDER BY d.created_at DESC`;
    const result = await pool.query(query, values);
    return reply.send({ success: true, data: { deployments: result.rows } });
  });

  /* -------- Goals (I.5.5) -------- */

  app.get('/infra/goals', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const type = params.type;
    const status = params.status;

    let query = `SELECT id, org_id, type, title, description, target_value, current_value,
                        unit, deadline, status, milestones, created_at, updated_at
                 FROM economy_goals WHERE org_id = $1`;
    const values: unknown[] = [orgId];

    if (type) { values.push(type); query += ` AND type = $${values.length}`; }
    if (status) { values.push(status); query += ` AND status = $${values.length}`; }

    query += ` ORDER BY deadline`;
    const result = await pool.query(query, values);
    return reply.send({ success: true, data: { goals: result.rows } });
  });

  app.post('/infra/goals', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const body = request.body as Record<string, unknown>;

    const title = String(body?.title || '').trim();
    const type = String(body?.type || 'custom');
    const targetValue = Number(body?.target_value || 0);
    const unit = String(body?.unit || '');
    const deadline = String(body?.deadline || '');

    if (!title) return reply.status(400).send({ success: false, error: { code: 'MISSING_TITLE', message: 'title is required' } });
    if (!deadline) return reply.status(400).send({ success: false, error: { code: 'MISSING_DEADLINE', message: 'deadline is required' } });

    const validTypes = ['revenue', 'infrastructure', 'cost_reduction', 'performance', 'uptime', 'custom'];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_TYPE', message: `type must be one of: ${validTypes.join(', ')}` } });
    }

    const id = `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const milestones = Array.isArray(body?.milestones) ? body.milestones : [];

    await pool.query(
      `INSERT INTO economy_goals (id, org_id, type, title, description, target_value, unit, deadline, milestones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, orgId, type, title, String(body?.description || ''), targetValue, unit, deadline, JSON.stringify(milestones)],
    );

    await writeAudit(pool, orgId, userId, 'goal_created', 'economy_goal', id, { title, type, targetValue });
    logger.info('Economy goal created', { orgId, id, title, type });
    return reply.status(201).send({ success: true, data: { id, title, type, target_value: targetValue, status: 'active' } });
  });

  app.patch('/infra/goals/:id/progress', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const goalId = (request.params as any).id;
    const body = request.body as Record<string, unknown>;
    const currentValue = Number(body?.current_value || 0);

    // Check if goal is achieved
    const goal = await pool.query(
      `SELECT target_value, milestones FROM economy_goals WHERE id = $1 AND org_id = $2 AND status = 'active'`,
      [goalId, orgId],
    );

    if (goal.rowCount === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });

    const targetValue = Number(goal.rows[0].target_value);
    const newStatus = currentValue >= targetValue ? 'achieved' : 'active';

    // Update milestones
    const milestones = goal.rows[0].milestones || [];
    const now = new Date().toISOString();
    for (const m of milestones) {
      if (!m.achieved && currentValue >= m.targetValue) {
        m.achieved = true;
        m.achievedAt = now;
      }
    }

    const result = await pool.query(
      `UPDATE economy_goals SET current_value = $1, status = $2, milestones = $3
       WHERE id = $4 AND org_id = $5 RETURNING id, current_value, status`,
      [currentValue, newStatus, JSON.stringify(milestones), goalId, orgId],
    );

    return reply.send({ success: true, data: result.rows[0] });
  });

  /* -------- Cost Report -------- */

  app.get('/infra/costs', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const nodesCost = await pool.query(
      `SELECT id, hostname, (costs->>'monthlyCost')::numeric AS monthly_cost
       FROM infra_nodes WHERE org_id = $1 ORDER BY (costs->>'monthlyCost')::numeric DESC`,
      [orgId],
    );

    const totalCost = nodesCost.rows.reduce((sum: number, r: any) => sum + Number(r.monthly_cost || 0), 0);

    return reply.send({
      success: true,
      data: {
        totalMonthlyCost: totalCost,
        byNode: nodesCost.rows.map((r: any) => ({ nodeId: r.id, hostname: r.hostname, cost: Number(r.monthly_cost || 0) })),
      },
    });
  });

  /* -------- Stats -------- */

  app.get('/infra/stats', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const nodeStats = await pool.query(
      `SELECT status, COUNT(*)::int AS count FROM infra_nodes WHERE org_id = $1 GROUP BY status`,
      [orgId],
    );

    const deployStats = await pool.query(
      `SELECT d.status, COUNT(*)::int AS count
       FROM infra_deployments d JOIN infra_nodes n ON n.id = d.node_id
       WHERE n.org_id = $1 GROUP BY d.status`,
      [orgId],
    );

    const proposalStats = await pool.query(
      `SELECT status, COUNT(*)::int AS count FROM infra_proposals WHERE org_id = $1 GROUP BY status`,
      [orgId],
    );

    const goalStats = await pool.query(
      `SELECT status, COUNT(*)::int AS count FROM economy_goals WHERE org_id = $1 GROUP BY status`,
      [orgId],
    );

    return reply.send({
      success: true,
      data: {
        nodes: nodeStats.rows,
        deployments: deployStats.rows,
        proposals: proposalStats.rows,
        goals: goalStats.rows,
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
    logger.warn('Failed to write infra audit log', { orgId, eventType, resourceId });
  }
}
