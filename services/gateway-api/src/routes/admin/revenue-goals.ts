// ---------------------------------------------------------------------------
// Revenue Goals — organisational financial targets with milestone tracking.
// First goal: €20,000 to repay 47Network startup loan.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('revenue-goals');

interface GoalRow {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  target_amount: string;
  current_amount: string;
  currency: string;
  status: string;
  priority: number;
  deadline: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  completed_at: Date | null;
  updated_at: Date;
}

function toGoal(r: GoalRow) {
  const target = Number(r.target_amount);
  const current = Number(r.current_amount);
  return {
    id: r.id,
    orgId: r.org_id,
    title: r.title,
    description: r.description,
    targetAmount: target,
    currentAmount: current,
    progressPct: target > 0 ? Math.min(100, Math.round((current / target) * 10000) / 100) : 0,
    currency: r.currency,
    status: r.status,
    priority: r.priority,
    deadline: r.deadline ? r.deadline.toISOString() : null,
    metadata: r.metadata ?? {},
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    updatedAt: r.updated_at.toISOString(),
  };
}

function newId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

export function registerRevenueGoalRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // GET /v1/admin/goals — list all goals
  app.get('/goals', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const status = query.status || undefined;
    const limit = Math.min(Math.max(1, Number(query.limit) || 50), 200);

    const values: unknown[] = [limit];
    let where = '1=1';
    if (status) { values.push(status); where += ` AND status = $${values.length}`; }

    const res = await pool.query<GoalRow>(
      `SELECT * FROM revenue_goals WHERE ${where} ORDER BY priority ASC, created_at ASC LIMIT $1`,
      values,
    );
    return reply.send({ success: true, data: { goals: res.rows.map(toGoal) } });
  });

  // GET /v1/admin/goals/:id — single goal
  app.get('/goals/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const res = await pool.query<GoalRow>(`SELECT * FROM revenue_goals WHERE id = $1`, [id]);
    if (!res.rows[0]) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    return reply.send({ success: true, data: { goal: toGoal(res.rows[0]) } });
  });

  // POST /v1/admin/goals — create a goal
  app.post('/goals', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    if (!body.title || !body.targetAmount) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'title and targetAmount required' } });
    }
    const id = newId();
    const orgId = (req as any).orgId ?? 'default';
    const res = await pool.query<GoalRow>(
      `INSERT INTO revenue_goals (id, org_id, title, description, target_amount, currency, priority, deadline, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING *`,
      [
        id, orgId, body.title, body.description ?? null,
        body.targetAmount, body.currency ?? 'EUR',
        body.priority ?? 1, body.deadline ?? null,
        JSON.stringify(body.metadata ?? {}),
      ],
    );
    logger.info('Goal created', { id, title: body.title, target: body.targetAmount });
    return reply.status(201).send({ success: true, data: { goal: toGoal(res.rows[0]) } });
  });

  // PATCH /v1/admin/goals/:id — update goal fields
  app.patch('/goals/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const [key, val] of Object.entries(body)) {
      const col = key === 'targetAmount' ? 'target_amount'
        : key === 'currentAmount' ? 'current_amount'
        : key === 'orgId' ? null // can't change orgId
        : key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      if (!col) continue;
      vals.push(key === 'metadata' ? JSON.stringify(val) : val);
      sets.push(`${col} = $${vals.length}${key === 'metadata' ? '::jsonb' : ''}`);
    }
    if (sets.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_FIELDS' } });
    }
    sets.push('updated_at = NOW()');
    vals.push(id);
    const res = await pool.query<GoalRow>(
      `UPDATE revenue_goals SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    if (!res.rows[0]) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    const goal = toGoal(res.rows[0]);
    logger.info('Goal updated', { id, progressPct: goal.progressPct });
    return reply.send({ success: true, data: { goal } });
  });

  // POST /v1/admin/goals/:id/contribute — add revenue toward a goal
  app.post('/goals/:id/contribute', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_AMOUNT' } });
    }

    const res = await pool.query<GoalRow>(
      `UPDATE revenue_goals
         SET current_amount = current_amount + $2,
             updated_at = NOW(),
             status = CASE WHEN current_amount + $2 >= target_amount THEN 'completed' ELSE status END,
             completed_at = CASE WHEN current_amount + $2 >= target_amount AND completed_at IS NULL THEN NOW() ELSE completed_at END
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [id, amount],
    );
    if (!res.rows[0]) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND_OR_INACTIVE' } });

    const goal = toGoal(res.rows[0]);
    publishNats(natsConn, 'sven.goal.progress', {
      goalId: goal.id, title: goal.title, currentAmount: goal.currentAmount,
      targetAmount: goal.targetAmount, progressPct: goal.progressPct,
      currency: goal.currency, contributedAmount: amount,
    });

    if (goal.status === 'completed') {
      publishNats(natsConn, 'sven.goal.completed', {
        goalId: goal.id, title: goal.title, targetAmount: goal.targetAmount,
        currency: goal.currency,
      });
      logger.info('🎉 Goal completed!', { id: goal.id, title: goal.title, target: goal.targetAmount });
    }

    return reply.send({ success: true, data: { goal } });
  });

  // GET /v1/admin/goals/summary — overall progress
  app.get('/goals/summary', async (_req, reply) => {
    const res = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')    AS active_count,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
        COALESCE(SUM(current_amount) FILTER (WHERE status = 'active'), 0) AS total_progress,
        COALESCE(SUM(target_amount) FILTER (WHERE status = 'active'), 0)  AS total_target
      FROM revenue_goals
    `);
    const row = res.rows[0];
    const totalTarget = Number(row.total_target);
    const totalProgress = Number(row.total_progress);
    return reply.send({
      success: true,
      data: {
        activeGoals: Number(row.active_count),
        completedGoals: Number(row.completed_count),
        totalProgress,
        totalTarget,
        overallPct: totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 10000) / 100 : 0,
      },
    });
  });
}
