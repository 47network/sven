// ---------------------------------------------------------------------------
// Oversight Dashboard — Sven's central command for the autonomous economy.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('oversight-dashboard');

const VALID_COMMAND_TYPES = ['suspend', 'resume', 'prioritize', 'deprioritize', 'reassign', 'review'] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

export function registerOversightDashboardRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // ── GET /oversight/dashboard — economy-wide metrics ──
  app.get('/oversight/dashboard', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const dashboard: Record<string, unknown> = {};

    // Agents by archetype & status
    try {
      const agentsRes = await pool.query(
        `SELECT archetype, status, COUNT(*)::int AS count
           FROM agent_profiles WHERE org_id = $1
          GROUP BY archetype, status`,
        [orgId],
      );
      dashboard.agents = {
        breakdown: agentsRes.rows,
        total: agentsRes.rows.reduce((s: number, r: any) => s + r.count, 0),
      };
    } catch { dashboard.agents = { breakdown: [], total: 0 }; }

    // Crews by type & status
    try {
      const crewsRes = await pool.query(
        `SELECT crew_type, status, COUNT(*)::int AS count
           FROM agent_crews WHERE org_id = $1
          GROUP BY crew_type, status`,
        [orgId],
      );
      dashboard.crews = {
        breakdown: crewsRes.rows,
        total: crewsRes.rows.reduce((s: number, r: any) => s + r.count, 0),
      };
    } catch { dashboard.crews = { breakdown: [], total: 0 }; }

    // Tasks summary
    try {
      const tasksRes = await pool.query(
        `SELECT status, COUNT(*)::int AS count
           FROM marketplace_tasks
          GROUP BY status`,
      );
      dashboard.tasks = tasksRes.rows;
    } catch { dashboard.tasks = []; }

    // 47Token circulation
    try {
      const tokenRes = await pool.query(
        `SELECT COALESCE(SUM(token_balance), 0)::int AS total_circulation
           FROM agent_profiles WHERE org_id = $1`,
        [orgId],
      );
      dashboard.tokensInCirculation = tokenRes.rows[0]?.total_circulation ?? 0;
    } catch { dashboard.tokensInCirculation = 0; }

    // Active anomalies
    try {
      const anomRes = await pool.query(
        `SELECT severity, COUNT(*)::int AS count
           FROM agent_anomalies WHERE status IN ('open','investigating')
          GROUP BY severity`,
      );
      dashboard.activeAnomalies = anomRes.rows;
    } catch { dashboard.activeAnomalies = []; }

    // Revenue goal progress
    try {
      const goalRes = await pool.query(
        `SELECT id, name, target_amount, current_amount, status
           FROM revenue_goals WHERE org_id = $1 AND status = 'active'
          ORDER BY created_at ASC LIMIT 5`,
        [orgId],
      );
      dashboard.revenueGoals = goalRes.rows;
    } catch { dashboard.revenueGoals = []; }

    // Top earning agents (by tokens)
    try {
      const topRes = await pool.query(
        `SELECT agent_id, display_name, archetype, token_balance
           FROM agent_profiles WHERE org_id = $1
          ORDER BY token_balance DESC NULLS LAST
          LIMIT 10`,
        [orgId],
      );
      dashboard.topEarners = topRes.rows;
    } catch { dashboard.topEarners = []; }

    return reply.send({ success: true, dashboard });
  });

  // ── GET /oversight/agents/:agentId/performance — single agent metrics ──
  app.get('/oversight/agents/:agentId/performance', async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const orgId = (req as any).orgId ?? 'default';

    const performance: Record<string, unknown> = { agentId };

    // Profile
    try {
      const profRes = await pool.query(
        'SELECT * FROM agent_profiles WHERE agent_id = $1 AND org_id = $2',
        [agentId, orgId],
      );
      performance.profile = profRes.rows[0] ?? null;
    } catch { performance.profile = null; }

    // Task history
    try {
      const taskRes = await pool.query(
        `SELECT status, COUNT(*)::int AS count
           FROM marketplace_tasks WHERE agent_id = $1
          GROUP BY status`,
        [agentId],
      );
      performance.tasks = taskRes.rows;
    } catch { performance.tasks = []; }

    // Token history (recent ledger entries)
    try {
      const tokenRes = await pool.query(
        `SELECT kind, amount, description, created_at
           FROM agent_token_ledger WHERE agent_id = $1
          ORDER BY created_at DESC LIMIT 20`,
        [agentId],
      );
      performance.tokenHistory = tokenRes.rows;
    } catch { performance.tokenHistory = []; }

    // Crew memberships
    try {
      const crewRes = await pool.query(
        `SELECT c.id, c.name, c.crew_type, m.role_in_crew
           FROM agent_crew_members m
           JOIN agent_crews c ON c.id = m.crew_id
          WHERE m.agent_id = $1 AND c.status = 'active'`,
        [agentId],
      );
      performance.crews = crewRes.rows;
    } catch { performance.crews = []; }

    // Anomalies
    try {
      const anomRes = await pool.query(
        `SELECT id, anomaly_type, severity, status, description, created_at
           FROM agent_anomalies WHERE target_agent_id = $1
          ORDER BY created_at DESC LIMIT 10`,
        [agentId],
      );
      performance.anomalies = anomRes.rows;
    } catch { performance.anomalies = []; }

    // Business space
    try {
      const bizRes = await pool.query(
        `SELECT business_subdomain, business_url, business_status
           FROM agent_profiles WHERE agent_id = $1`,
        [agentId],
      );
      performance.businessSpace = bizRes.rows[0] ?? null;
    } catch { performance.businessSpace = null; }

    return reply.send({ success: true, performance });
  });

  // ── POST /oversight/commands — Sven issues command to agent ──
  app.post('/oversight/commands', async (req, reply) => {
    const body = req.body as {
      target_agent_id?: string;
      command_type?: string;
      payload?: Record<string, unknown>;
      reason?: string;
    };

    if (!body.target_agent_id) return reply.status(400).send({ success: false, error: 'target_agent_id is required' });
    if (!body.command_type || !VALID_COMMAND_TYPES.includes(body.command_type as any)) {
      return reply.status(400).send({
        success: false,
        error: `command_type must be one of: ${VALID_COMMAND_TYPES.join(', ')}`,
      });
    }
    if (!body.reason) return reply.status(400).send({ success: false, error: 'reason is required' });

    // Execute command side-effect
    if (body.command_type === 'suspend') {
      try {
        await pool.query(
          `UPDATE agent_profiles SET status = 'suspended', updated_at = NOW() WHERE agent_id = $1`,
          [body.target_agent_id],
        );
      } catch { /* agent may not exist */ }
    } else if (body.command_type === 'resume') {
      try {
        await pool.query(
          `UPDATE agent_profiles SET status = 'active', updated_at = NOW() WHERE agent_id = $1`,
          [body.target_agent_id],
        );
      } catch { /* agent may not exist */ }
    }

    // Create command message
    const msgId = newId('msg');
    try {
      await pool.query(
        `INSERT INTO agent_messages
           (id, from_agent_id, to_agent_id, subject, body, message_type, priority)
         VALUES ($1, 'sven-oversight', $2, $3, $4, 'command', 'high')`,
        [
          msgId,
          body.target_agent_id,
          `Command: ${body.command_type}`,
          JSON.stringify({ commandType: body.command_type, payload: body.payload ?? {}, reason: body.reason }),
        ],
      );
    } catch (err) {
      logger.warn('Failed to create command message', { err: (err as Error).message });
    }

    logger.info('Oversight command issued', {
      target: body.target_agent_id,
      command: body.command_type,
      reason: body.reason,
    });

    publishNats(natsConn, 'sven.oversight.command_issued', {
      messageId: msgId,
      targetAgentId: body.target_agent_id,
      commandType: body.command_type,
      reason: body.reason,
    });

    return reply.status(201).send({
      success: true,
      messageId: msgId,
      commandType: body.command_type,
      targetAgentId: body.target_agent_id,
    });
  });
}
