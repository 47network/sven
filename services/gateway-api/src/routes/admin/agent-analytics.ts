import { FastifyInstance } from 'fastify';
import pg from 'pg';

type TimeWindow = {
  startIso: string;
  endIso: string;
  label: string;
};

type AlertThresholds = {
  success_rate_below: number;
  error_rate_above: number;
  avg_response_ms_above: number;
  self_correction_below: number;
  cost_usd_above: number;
};

class AgentAnalyticsValidationError extends Error {}
const MAX_CUSTOM_WINDOW_DAYS = 90;
const MAX_CUSTOM_WINDOW_MS = MAX_CUSTOM_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const DEFAULT_ALERTS: AlertThresholds = {
  success_rate_below: 75,
  error_rate_above: 25,
  avg_response_ms_above: 9000,
  self_correction_below: 50,
  cost_usd_above: 25,
};

function parseWindow(query: Record<string, unknown>): TimeWindow {
  const now = new Date();
  const range = String(query.range || '7d').trim().toLowerCase();
  const customStartRaw = String(query.start || '').trim();
  const customEndRaw = String(query.end || '').trim();

  let start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let label = '7d';
  if (range === '24h') {
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    label = '24h';
  } else if (range === '30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    label = '30d';
  } else if (range === 'custom') {
    if (!customStartRaw || !customEndRaw) {
      throw new AgentAnalyticsValidationError('custom range requires valid start and end timestamps');
    }
    const parsedStart = new Date(customStartRaw);
    const parsedEnd = new Date(customEndRaw);
    if (Number.isFinite(parsedStart.getTime()) && Number.isFinite(parsedEnd.getTime())) {
      start = parsedStart;
      if (parsedEnd <= start) {
        throw new AgentAnalyticsValidationError('custom range requires end to be greater than start');
      }
      if (parsedEnd.getTime() - start.getTime() > MAX_CUSTOM_WINDOW_MS) {
        throw new AgentAnalyticsValidationError(`custom range cannot exceed ${MAX_CUSTOM_WINDOW_DAYS} days`);
      }
      return { startIso: start.toISOString(), endIso: parsedEnd.toISOString(), label: 'custom' };
    }
    throw new AgentAnalyticsValidationError('custom range requires valid start and end timestamps');
  }

  return { startIso: start.toISOString(), endIso: now.toISOString(), label };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeAlertConfig(input: unknown): AlertThresholds {
  const rec = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    success_rate_below: clampNumber(rec.success_rate_below, 0, 100, DEFAULT_ALERTS.success_rate_below),
    error_rate_above: clampNumber(rec.error_rate_above, 0, 100, DEFAULT_ALERTS.error_rate_above),
    avg_response_ms_above: clampNumber(rec.avg_response_ms_above, 100, 120000, DEFAULT_ALERTS.avg_response_ms_above),
    self_correction_below: clampNumber(rec.self_correction_below, 0, 100, DEFAULT_ALERTS.self_correction_below),
    cost_usd_above: clampNumber(rec.cost_usd_above, 0, 100000, DEFAULT_ALERTS.cost_usd_above),
  };
}

function escapeCsv(value: unknown): string {
  let text = String(value ?? '');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/^(\s*)([=+\-@])/, "$1'$2");
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function queryAgentAnalytics(
  pool: pg.Pool,
  orgId: string,
  window: TimeWindow,
): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(
    `WITH primary_agent_chat AS (
       SELECT
         asn.agent_id,
         asn.session_id AS chat_id,
         ROW_NUMBER() OVER (PARTITION BY asn.session_id ORDER BY asn.created_at ASC) AS rn
       FROM agent_sessions asn
       JOIN chats c ON c.id = asn.session_id
       WHERE c.organization_id = $1
     ),
     agent_chat AS (
       SELECT agent_id, chat_id
       FROM primary_agent_chat
       WHERE rn = 1
     ),
     tool_runs_agg AS (
       SELECT
         ac.agent_id,
         COUNT(*)::int AS tool_runs_total,
         COUNT(*) FILTER (WHERE tr.status IN ('success', 'completed'))::int AS tool_runs_success,
         COUNT(*) FILTER (WHERE tr.status IN ('error', 'timeout', 'denied'))::int AS tool_runs_error,
         AVG(NULLIF(tr.duration_ms, 0))::numeric AS avg_response_ms
       FROM agent_chat ac
       JOIN tool_runs tr ON tr.chat_id = ac.chat_id
       WHERE tr.created_at >= $2::timestamptz
         AND tr.created_at <= $3::timestamptz
       GROUP BY ac.agent_id
     ),
     tool_usage AS (
       SELECT
         ac.agent_id,
         tr.tool_name,
         COUNT(*)::int AS tool_count
       FROM agent_chat ac
       JOIN tool_runs tr ON tr.chat_id = ac.chat_id
       WHERE tr.created_at >= $2::timestamptz
         AND tr.created_at <= $3::timestamptz
       GROUP BY ac.agent_id, tr.tool_name
     ),
     tool_usage_json AS (
       SELECT
         agent_id,
         jsonb_object_agg(tool_name, tool_count) AS tool_usage
       FROM tool_usage
       GROUP BY agent_id
     ),
     retry_agg AS (
       SELECT
         ac.agent_id,
         COUNT(*)::int AS retry_total,
         COUNT(*) FILTER (WHERE r.outcome = 'success')::int AS retry_success
       FROM agent_chat ac
       JOIN tool_runs tr ON tr.chat_id = ac.chat_id
       JOIN tool_retries r ON r.tool_call_id = tr.id
       WHERE r.created_at >= $2::timestamptz
         AND r.created_at <= $3::timestamptz
       GROUP BY ac.agent_id
     ),
     llm_agg AS (
       SELECT
         ac.agent_id,
         SUM(COALESCE(l.prompt_tokens, 0) + COALESCE(l.completion_tokens, 0))::bigint AS total_tokens,
         SUM(
           ((COALESCE(l.prompt_tokens, 0) + COALESCE(l.completion_tokens, 0))::numeric / 1000)
           * COALESCE(m.cost_per_1k_tokens, 0)
         )::numeric AS total_cost_usd
       FROM agent_chat ac
       JOIN llm_audit_log l ON l.chat_id::text = ac.chat_id::text
       LEFT JOIN models m ON lower(m.name) = lower(l.model_name)
       WHERE l.created_at >= $2::timestamptz
         AND l.created_at <= $3::timestamptz
       GROUP BY ac.agent_id
     ),
     chat_message_agg AS (
       SELECT
         ac.agent_id,
         m.chat_id,
         COUNT(*)::int AS message_count,
         COUNT(*) FILTER (WHERE m.role = 'user')::int AS user_message_count
       FROM agent_chat ac
       JOIN messages m ON m.chat_id = ac.chat_id
       WHERE m.created_at >= $2::timestamptz
         AND m.created_at <= $3::timestamptz
       GROUP BY ac.agent_id, m.chat_id
     ),
     chat_agg AS (
       SELECT
         agent_id,
         COUNT(*)::int AS chat_count,
         AVG(message_count)::numeric AS avg_conversation_length,
         AVG(GREATEST(user_message_count - 1, 0))::numeric AS avg_follow_up_count
       FROM chat_message_agg
       GROUP BY agent_id
     ),
     org_agents AS (
       SELECT DISTINCT agent_id
       FROM agent_chat
     )
     SELECT
       a.id AS agent_id,
       a.name AS agent_name,
       COALESCE(tr.tool_runs_total, 0) AS task_total,
       COALESCE(tr.tool_runs_success, 0) AS task_success,
       COALESCE(tr.tool_runs_error, 0) AS task_error,
       CASE
         WHEN COALESCE(tr.tool_runs_total, 0) > 0
           THEN ROUND((COALESCE(tr.tool_runs_success, 0)::numeric / tr.tool_runs_total::numeric) * 100, 2)
         ELSE 0
       END AS task_success_rate_pct,
       COALESCE(ROUND(tr.avg_response_ms, 2), 0) AS avg_response_ms,
       COALESCE(ll.total_tokens, 0) AS total_tokens,
       COALESCE(ROUND(ll.total_cost_usd, 6), 0) AS total_cost_usd,
       COALESCE(tu.tool_usage, '{}'::jsonb) AS tool_usage_frequency,
       CASE
         WHEN COALESCE(tr.tool_runs_total, 0) > 0
           THEN ROUND((COALESCE(tr.tool_runs_error, 0)::numeric / tr.tool_runs_total::numeric) * 100, 2)
         ELSE 0
       END AS error_rate_pct,
       COALESCE(rt.retry_total, 0) AS self_correction_total,
       COALESCE(rt.retry_success, 0) AS self_correction_success,
       CASE
         WHEN COALESCE(rt.retry_total, 0) > 0
           THEN ROUND((COALESCE(rt.retry_success, 0)::numeric / rt.retry_total::numeric) * 100, 2)
         ELSE 0
       END AS self_correction_success_rate_pct,
       COALESCE(ca.chat_count, 0) AS chat_count,
       COALESCE(ROUND(ca.avg_conversation_length, 2), 0) AS avg_conversation_length,
       COALESCE(ROUND(ca.avg_follow_up_count, 2), 0) AS avg_follow_up_count
     FROM org_agents oa
     JOIN agents a ON a.id = oa.agent_id
     LEFT JOIN tool_runs_agg tr ON tr.agent_id = a.id
     LEFT JOIN llm_agg ll ON ll.agent_id = a.id
     LEFT JOIN tool_usage_json tu ON tu.agent_id = a.id
     LEFT JOIN retry_agg rt ON rt.agent_id = a.id
     LEFT JOIN chat_agg ca ON ca.agent_id = a.id
     WHERE a.status = 'active'
     ORDER BY a.name ASC`,
    [orgId, window.startIso, window.endIso],
  );

  return result.rows;
}

function alertsFromRows(rows: Array<Record<string, unknown>>, alerts: AlertThresholds): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const agentId = String(row.agent_id || '');
    const agentName = String(row.agent_name || '');
    const triggers: string[] = [];
    const successRate = Number(row.task_success_rate_pct || 0);
    const errorRate = Number(row.error_rate_pct || 0);
    const avgResponseMs = Number(row.avg_response_ms || 0);
    const selfCorrectionRate = Number(row.self_correction_success_rate_pct || 0);
    const costUsd = Number(row.total_cost_usd || 0);

    if (successRate < alerts.success_rate_below) {
      triggers.push(`task success rate ${successRate.toFixed(2)}% < ${alerts.success_rate_below}%`);
    }
    if (errorRate > alerts.error_rate_above) {
      triggers.push(`error rate ${errorRate.toFixed(2)}% > ${alerts.error_rate_above}%`);
    }
    if (avgResponseMs > alerts.avg_response_ms_above) {
      triggers.push(`avg response ${avgResponseMs.toFixed(2)}ms > ${alerts.avg_response_ms_above}ms`);
    }
    if (selfCorrectionRate < alerts.self_correction_below && Number(row.self_correction_total || 0) > 0) {
      triggers.push(`self-correction success ${selfCorrectionRate.toFixed(2)}% < ${alerts.self_correction_below}%`);
    }
    if (costUsd > alerts.cost_usd_above) {
      triggers.push(`cost ${costUsd.toFixed(6)} USD > ${alerts.cost_usd_above} USD`);
    }

    if (triggers.length > 0) {
      out.push({
        agent_id: agentId,
        agent_name: agentName,
        triggers,
      });
    }
  }

  return out;
}

export async function registerAgentAnalyticsRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  app.get('/agents/analytics', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    let window: TimeWindow;
    try {
      window = parseWindow((request.query || {}) as Record<string, unknown>);
    } catch (err) {
      if (err instanceof AgentAnalyticsValidationError) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: err.message } });
      }
      throw err;
    }
    const rows = await queryAgentAnalytics(pool, orgId, window);
    return reply.send({ success: true, data: { window, rows } });
  });

  app.get('/agents/analytics/export', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const query = (request.query || {}) as Record<string, unknown>;
    const format = String(query.format || 'csv').trim().toLowerCase();
    if (format !== 'csv') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Only format=csv is supported' } });
    }

    let window: TimeWindow;
    try {
      window = parseWindow(query);
    } catch (err) {
      if (err instanceof AgentAnalyticsValidationError) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: err.message } });
      }
      throw err;
    }
    const rows = await queryAgentAnalytics(pool, orgId, window);

    const headers = [
      'agent_id',
      'agent_name',
      'task_total',
      'task_success',
      'task_error',
      'task_success_rate_pct',
      'avg_response_ms',
      'total_tokens',
      'total_cost_usd',
      'error_rate_pct',
      'self_correction_total',
      'self_correction_success',
      'self_correction_success_rate_pct',
      'chat_count',
      'avg_conversation_length',
      'avg_follow_up_count',
    ];
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => escapeCsv((row as Record<string, unknown>)[header])).join(','),
      ),
    ];
    const csv = csvRows.join('\n');

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="agent-analytics-${window.label}.csv"`);
    return reply.send(csv);
  });

  app.get('/agents/analytics/alerts', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const res = await pool.query(
      `SELECT value
       FROM organization_settings
       WHERE organization_id = $1 AND key = 'agent.analytics.alert.thresholds'
       LIMIT 1`,
      [orgId],
    );
    const config = normalizeAlertConfig(res.rows[0]?.value || DEFAULT_ALERTS);
    return reply.send({ success: true, data: config });
  });

  app.put('/agents/analytics/alerts', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const nextConfig = normalizeAlertConfig(body);

    await pool.query(
      `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
       VALUES ($1, 'agent.analytics.alert.thresholds', $2::jsonb, NOW(), $3)
       ON CONFLICT (organization_id, key) DO UPDATE
       SET value = $2::jsonb, updated_at = NOW(), updated_by = $3`,
      [orgId, JSON.stringify(nextConfig), String((request as any).userId || '') || null],
    );

    return reply.send({ success: true, data: nextConfig });
  });

  app.get('/agents/analytics/alerts/evaluate', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    let window: TimeWindow;
    try {
      window = parseWindow((request.query || {}) as Record<string, unknown>);
    } catch (err) {
      if (err instanceof AgentAnalyticsValidationError) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: err.message } });
      }
      throw err;
    }
    const configRes = await pool.query(
      `SELECT value
       FROM organization_settings
       WHERE organization_id = $1 AND key = 'agent.analytics.alert.thresholds'
       LIMIT 1`,
      [orgId],
    );
    const alerts = normalizeAlertConfig(configRes.rows[0]?.value || DEFAULT_ALERTS);
    const rows = await queryAgentAnalytics(pool, orgId, window);
    const triggered = alertsFromRows(rows, alerts);

    return reply.send({
      success: true,
      data: {
        window,
        thresholds: alerts,
        triggered_count: triggered.length,
        triggered,
      },
    });
  });
}
