// ---------------------------------------------------------------------------
// Accountant Module — financial oversight, anomaly detection, reports.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('accountant');

const VALID_ANOMALY_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

// ── Anomaly detection thresholds ──
const THRESHOLDS = {
  unusualAmountMultiplier: 3,        // tx > 3× agent average
  frequencySpikePerHour: 10,         // >10 tx in 1 hour
  revenueDropPct: 50,                // >50% drop vs prior period
  costOverrunMultiplier: 2,          // costs > 200% of revenue
  dormantDays: 7,                    // 0 tasks in 7 days
};

export function registerAccountantRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // ── POST /oversight/scan — trigger anomaly scan ──
  app.post('/oversight/scan', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as { period_hours?: number; accountant_agent_id?: string } | undefined;
    const periodHours = body?.period_hours ?? 24;
    const detectedBy = body?.accountant_agent_id ?? 'system-accountant';

    const anomalies: Array<{
      anomalyType: string;
      severity: string;
      targetAgentId: string | null;
      description: string;
      evidence: Record<string, unknown>;
    }> = [];

    // Rule 1: unusual_amount — transactions > 3× agent average
    try {
      const uaRes = await pool.query(
        `WITH agent_avg AS (
           SELECT account_id, AVG(ABS(amount)) AS avg_amt
             FROM treasury_transactions
            WHERE created_at > NOW() - INTERVAL '90 days'
            GROUP BY account_id
         )
         SELECT t.id, t.account_id, t.amount, aa.avg_amt
           FROM treasury_transactions t
           JOIN agent_avg aa ON aa.account_id = t.account_id
          WHERE t.created_at > NOW() - ($1 || ' hours')::INTERVAL
            AND ABS(t.amount) > aa.avg_amt * $2`,
        [periodHours, THRESHOLDS.unusualAmountMultiplier],
      );
      for (const row of uaRes.rows) {
        anomalies.push({
          anomalyType: 'unusual_amount',
          severity: 'high',
          targetAgentId: row.account_id,
          description: `Transaction ${row.id} amount ${row.amount} is ${(Math.abs(row.amount) / row.avg_amt).toFixed(1)}× the average`,
          evidence: { transactionId: row.id, amount: row.amount, avgAmount: row.avg_amt },
        });
      }
    } catch { /* treasury_transactions may not exist yet */ }

    // Rule 2: frequency_spike — >10 tx in 1 hour per account
    try {
      const fsRes = await pool.query(
        `SELECT account_id, date_trunc('hour', created_at) AS hr, COUNT(*)::int AS cnt
           FROM treasury_transactions
          WHERE created_at > NOW() - ($1 || ' hours')::INTERVAL
          GROUP BY account_id, hr
         HAVING COUNT(*) > $2`,
        [periodHours, THRESHOLDS.frequencySpikePerHour],
      );
      for (const row of fsRes.rows) {
        anomalies.push({
          anomalyType: 'frequency_spike',
          severity: 'medium',
          targetAgentId: row.account_id,
          description: `${row.cnt} transactions in a single hour for account ${row.account_id}`,
          evidence: { accountId: row.account_id, hour: row.hr, count: row.cnt },
        });
      }
    } catch { /* table may not exist */ }

    // Rule 3: dormant_agent — active agents with 0 tasks in dormantDays
    try {
      const daRes = await pool.query(
        `SELECT ap.agent_id, ap.display_name
           FROM agent_profiles ap
          WHERE ap.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM marketplace_tasks mt
               WHERE mt.agent_id = ap.agent_id
                 AND mt.created_at > NOW() - ($1 || ' days')::INTERVAL
            )`,
        [THRESHOLDS.dormantDays],
      );
      for (const row of daRes.rows) {
        anomalies.push({
          anomalyType: 'dormant_agent',
          severity: 'low',
          targetAgentId: row.agent_id,
          description: `Agent "${row.display_name}" (${row.agent_id}) has had no tasks in ${THRESHOLDS.dormantDays} days`,
          evidence: { agentId: row.agent_id, dormantDays: THRESHOLDS.dormantDays },
        });
      }
    } catch { /* tables may not exist */ }

    // Rule 4: revenue_drop — agent revenue dropped >50% vs prior period
    try {
      const rdRes = await pool.query(
        `WITH current_period AS (
           SELECT agent_id, SUM(CASE WHEN tokens_earned > 0 THEN tokens_earned ELSE 0 END) AS rev
             FROM marketplace_tasks
            WHERE completed_at > NOW() - ($1 || ' hours')::INTERVAL
            GROUP BY agent_id
         ),
         prior_period AS (
           SELECT agent_id, SUM(CASE WHEN tokens_earned > 0 THEN tokens_earned ELSE 0 END) AS rev
             FROM marketplace_tasks
            WHERE completed_at BETWEEN NOW() - ($1 * 2 || ' hours')::INTERVAL AND NOW() - ($1 || ' hours')::INTERVAL
            GROUP BY agent_id
         )
         SELECT pp.agent_id, pp.rev AS prior_rev, COALESCE(cp.rev, 0) AS current_rev
           FROM prior_period pp
           LEFT JOIN current_period cp ON cp.agent_id = pp.agent_id
          WHERE pp.rev > 0
            AND COALESCE(cp.rev, 0) < pp.rev * (1 - $2::numeric / 100)`,
        [periodHours, THRESHOLDS.revenueDropPct],
      );
      for (const row of rdRes.rows) {
        anomalies.push({
          anomalyType: 'revenue_drop',
          severity: 'medium',
          targetAgentId: row.agent_id,
          description: `Revenue dropped from ${row.prior_rev} to ${row.current_rev} tokens`,
          evidence: { agentId: row.agent_id, priorRevenue: row.prior_rev, currentRevenue: row.current_rev },
        });
      }
    } catch { /* tables may not exist */ }

    // Persist detected anomalies
    let inserted = 0;
    for (const a of anomalies) {
      const id = newId('anomaly');
      try {
        await pool.query(
          `INSERT INTO agent_anomalies (id, detected_by, target_agent_id, anomaly_type, severity, description, evidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [id, detectedBy, a.targetAgentId, a.anomalyType, a.severity, a.description, JSON.stringify(a.evidence)],
        );
        publishNats(natsConn, 'sven.agent.anomaly_detected', {
          anomalyId: id, ...a, detectedBy,
        });
        inserted++;
      } catch (err) {
        logger.warn('Failed to insert anomaly', { err: (err as Error).message });
      }
    }

    logger.info('Anomaly scan completed', { periodHours, scanned: 4, anomaliesFound: inserted });
    return reply.send({
      success: true,
      scanned: 4,
      anomaliesFound: inserted,
      byType: anomalies.reduce((acc, a) => {
        acc[a.anomalyType] = (acc[a.anomalyType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
  });

  // ── POST /oversight/reports/generate — generate performance reports ──
  app.post('/oversight/reports/generate', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as { period_days?: number } | undefined;
    const periodDays = body?.period_days ?? 1;
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - periodDays * 86_400_000);

    let reports: unknown[] = [];
    try {
      // Gather agents
      const agentsRes = await pool.query(
        `SELECT agent_id FROM agent_profiles WHERE org_id = $1 AND status = 'active'`,
        [orgId],
      );

      for (const agent of agentsRes.rows) {
        const aid = agent.agent_id;
        // Tasks
        const taskRes = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
             COUNT(*) FILTER (WHERE status = 'failed')::int    AS failed,
             COALESCE(SUM(tokens_earned) FILTER (WHERE status = 'completed'), 0)::int AS tokens
           FROM marketplace_tasks
           WHERE agent_id = $1 AND created_at BETWEEN $2 AND $3`,
          [aid, periodStart.toISOString(), periodEnd.toISOString()],
        );
        const t = taskRes.rows[0] ?? { completed: 0, failed: 0, tokens: 0 };

        // Anomalies for this agent
        const anomRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM agent_anomalies
            WHERE target_agent_id = $1 AND created_at BETWEEN $2 AND $3`,
          [aid, periodStart.toISOString(), periodEnd.toISOString()],
        );

        const id = newId('report');
        await pool.query(
          `INSERT INTO agent_performance_reports
             (id, agent_id, period_start, period_end, tasks_completed, tasks_failed,
              revenue_generated, tokens_earned, anomalies_detected, report_data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            id, aid, periodStart.toISOString(), periodEnd.toISOString(),
            t.completed, t.failed, 0, t.tokens,
            anomRes.rows[0]?.cnt ?? 0,
            JSON.stringify({ periodDays }),
          ],
        );
        reports.push({ id, agentId: aid, tasksCompleted: t.completed, tasksFailed: t.failed, tokensEarned: t.tokens });
      }
    } catch (err) {
      logger.warn('Report generation partial failure', { err: (err as Error).message });
    }

    publishNats(natsConn, 'sven.agent.report_generated', { reportsCount: reports.length, periodDays });
    return reply.send({ success: true, generated: reports.length, reports });
  });

  // ── GET /oversight/reports — list reports ──
  app.get('/oversight/reports', async (req, reply) => {
    const q = req.query as { agent_id?: string; limit?: string; offset?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    let where = '1=1';
    const params: unknown[] = [];
    let idx = 1;
    if (q.agent_id) { where += ` AND agent_id = $${idx++}`; params.push(q.agent_id); }

    const res = await pool.query(
      `SELECT * FROM agent_performance_reports WHERE ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return reply.send({ success: true, reports: res.rows, pagination: { limit, offset, returned: res.rows.length } });
  });

  // ── GET /oversight/reports/:reportId — single report ──
  app.get('/oversight/reports/:reportId', async (req, reply) => {
    const { reportId } = req.params as { reportId: string };
    const res = await pool.query('SELECT * FROM agent_performance_reports WHERE id = $1', [reportId]);
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: 'Report not found' });
    return reply.send({ success: true, report: res.rows[0] });
  });

  // ── GET /oversight/anomalies — list anomalies ──
  app.get('/oversight/anomalies', async (req, reply) => {
    const q = req.query as {
      status?: string; severity?: string; anomaly_type?: string;
      agent_id?: string; limit?: string; offset?: string;
    };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    let where = '1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (q.status && VALID_ANOMALY_STATUSES.includes(q.status as any)) {
      where += ` AND status = $${idx++}`; params.push(q.status);
    }
    if (q.severity && VALID_SEVERITIES.includes(q.severity as any)) {
      where += ` AND severity = $${idx++}`; params.push(q.severity);
    }
    if (q.anomaly_type) { where += ` AND anomaly_type = $${idx++}`; params.push(q.anomaly_type); }
    if (q.agent_id) { where += ` AND target_agent_id = $${idx++}`; params.push(q.agent_id); }

    const res = await pool.query(
      `SELECT * FROM agent_anomalies WHERE ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return reply.send({ success: true, anomalies: res.rows, pagination: { limit, offset, returned: res.rows.length } });
  });

  // ── PATCH /oversight/anomalies/:anomalyId — update status ──
  app.patch('/oversight/anomalies/:anomalyId', async (req, reply) => {
    const { anomalyId } = req.params as { anomalyId: string };
    const body = req.body as { status?: string; resolution_notes?: string };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.status && VALID_ANOMALY_STATUSES.includes(body.status as any)) {
      sets.push(`status = $${idx++}`); params.push(body.status);
      if (body.status === 'resolved') sets.push(`resolved_at = NOW()`);
    }
    if (body.resolution_notes !== undefined) {
      sets.push(`resolution_notes = $${idx++}`); params.push(body.resolution_notes);
    }
    if (sets.length === 0) return reply.status(400).send({ success: false, error: 'Nothing to update' });

    params.push(anomalyId);
    const res = await pool.query(
      `UPDATE agent_anomalies SET ${sets.join(', ')} WHERE id = $${idx++} RETURNING *`,
      params,
    );
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: 'Anomaly not found' });
    return reply.send({ success: true, anomaly: res.rows[0] });
  });

  // ── GET /oversight/anomalies/stats — aggregated stats ──
  app.get('/oversight/anomalies/stats', async (_req, reply) => {
    const res = await pool.query(
      `SELECT
         anomaly_type,
         severity,
         status,
         COUNT(*)::int AS count
       FROM agent_anomalies
       GROUP BY anomaly_type, severity, status
       ORDER BY count DESC`,
    );
    return reply.send({ success: true, stats: res.rows });
  });
}
