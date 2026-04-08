import { FastifyInstance } from 'fastify';
import { NatsConnection, JSONCodec } from 'nats';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { NATS_SUBJECTS, createLogger } from '@sven/shared';
import * as BackupService from '../../services/BackupService.js';
import { getIncidentStatus } from '../../services/IncidentService.js';
import type { EventEnvelope, NotifyPushEvent, RagIndexRequestEvent, RuntimeDispatchEvent, ToolRunRequestEvent } from '@sven/shared';

const logger = createLogger('admin-cron');
const jc = JSONCodec();

function publishRuntimeDispatch(nc: NatsConnection, data: RuntimeDispatchEvent) {
  const event: EventEnvelope<RuntimeDispatchEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data,
  };
  nc.publish(NATS_SUBJECTS.RUNTIME_DISPATCH, jc.encode(event));
}
const ALLOWED_CRON_HANDLERS = new Set([
  'health_check',
  'backup',
  'rag_reindex',
  'digest_generation',
  'send_message',
  'run_tool',
  'workflow',
]);

let cronStarted = false;
let cronTimer: ReturnType<typeof setInterval> | null = null;
const DEFAULT_CRON_TICK_MS = 15000;
const MIN_CRON_TICK_MS = 1000;
const MAX_CRON_TICK_MS = 3600000;
const DEFAULT_CRON_FAILURE_BACKOFF_MS = 60000;
const MIN_CRON_FAILURE_BACKOFF_MS = 5000;
const MAX_CRON_FAILURE_BACKOFF_MS = 86400000;
const DEFAULT_CRON_CLAIM_LEASE_MS = 30000;
const MIN_CRON_CLAIM_LEASE_MS = 5000;
const MAX_CRON_CLAIM_LEASE_MS = 300000;

async function cronJobsHasOrganizationId(pool: pg.Pool): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cron_jobs'
        AND column_name = 'organization_id'
      LIMIT 1`,
  );
  return result.rows.length > 0;
}

async function resolveFallbackOrganizationId(pool: pg.Pool): Promise<string | null> {
  const result = await pool.query(
    `SELECT id
       FROM organizations
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1`,
  );
  const organizationId = String(result.rows[0]?.id || '').trim();
  return organizationId || null;
}

function parseOptionalBoolean(raw: unknown): { valid: boolean; value: boolean | undefined } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: raw };
}

function parseCronTickIntervalMs(raw: unknown): { intervalMs: number; invalid: boolean } {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) {
    return { intervalMs: DEFAULT_CRON_TICK_MS, invalid: raw !== undefined && raw !== null && String(raw).trim().length > 0 };
  }
  if (parsed < MIN_CRON_TICK_MS || parsed > MAX_CRON_TICK_MS) {
    return { intervalMs: DEFAULT_CRON_TICK_MS, invalid: true };
  }
  return { intervalMs: parsed, invalid: false };
}

function parseCronFailureBackoffMs(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_CRON_FAILURE_BACKOFF_MS;
  }
  if (parsed < MIN_CRON_FAILURE_BACKOFF_MS) {
    return MIN_CRON_FAILURE_BACKOFF_MS;
  }
  if (parsed > MAX_CRON_FAILURE_BACKOFF_MS) {
    return MAX_CRON_FAILURE_BACKOFF_MS;
  }
  return parsed;
}

function parseCronClaimLeaseMs(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_CRON_CLAIM_LEASE_MS;
  }
  if (parsed < MIN_CRON_CLAIM_LEASE_MS) {
    return MIN_CRON_CLAIM_LEASE_MS;
  }
  if (parsed > MAX_CRON_CLAIM_LEASE_MS) {
    return MAX_CRON_CLAIM_LEASE_MS;
  }
  return parsed;
}

export async function registerCronRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  app.addHook('preHandler', async (request: any, reply) => {
    if (String(request.userRole || '') === 'platform_admin') return;
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
    return;
  });

  app.addHook('preHandler', async (request: any, reply) => {
    if (request.orgId) return;
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return;
  });

  app.addHook('preHandler', async (request: any, reply) => {
    const method = String(request.raw?.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return;

    const status = await getIncidentStatus();
    if (!status.killSwitchActive && !status.lockdownActive && !status.forensicsActive) return;

    reply.status(423).send({
      success: false,
      error: {
        code: 'INCIDENT_WRITE_BLOCKED',
        message: 'Write operations are blocked while incident controls are active',
      },
      data: {
        incident_status: status.status,
      },
    });
  });

  app.get('/cron', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const hasOrgColumn = await cronJobsHasOrganizationId(pool);
    const res = await pool.query(
      hasOrgColumn
        ? `SELECT id, name, expression, handler, payload, enabled, last_run, next_run, created_at, updated_at
           FROM cron_jobs
           WHERE organization_id = $1
           ORDER BY created_at DESC
           LIMIT 500`
        : `SELECT id, name, expression, handler, payload, enabled, last_run, next_run, created_at, updated_at
           FROM cron_jobs
           ORDER BY created_at DESC
           LIMIT 500`,
      hasOrgColumn ? [orgId] : [],
    );
    reply.send({ success: true, data: res.rows });
  });

  app.post('/cron', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const body = (request.body as {
      name?: string;
      expression?: string;
      handler?: string;
      payload?: Record<string, unknown>;
      enabled?: boolean;
    }) || {};

    const name = String(body.name || '').trim();
    const expression = String(body.expression || '').trim();
    const handler = String(body.handler || '').trim();
    const payload = body.payload || {};
    const enabledParsed = parseOptionalBoolean((body as { enabled?: unknown }).enabled);
    if (!enabledParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
      });
      return;
    }
    const enabled = enabledParsed.value ?? true;

    if (!name || !expression || !handler) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name, expression, handler are required' },
      });
      return;
    }
    if (!ALLOWED_CRON_HANDLERS.has(handler)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Unsupported cron handler' },
      });
      return;
    }
    if (!isValidCron(expression)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Invalid cron expression' },
      });
      return;
    }

    const id = uuidv7();
    const nextRun = computeNextRun(expression, new Date());
    const hasOrgColumn = await cronJobsHasOrganizationId(pool);
    await pool.query(
      hasOrgColumn
        ? `INSERT INTO cron_jobs (id, organization_id, name, expression, handler, payload, enabled, next_run, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`
        : `INSERT INTO cron_jobs (id, name, expression, handler, payload, enabled, next_run, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      hasOrgColumn
        ? [id, orgId, name, expression, handler, JSON.stringify(payload), enabled, nextRun?.toISOString() || null]
        : [id, name, expression, handler, JSON.stringify(payload), enabled, nextRun?.toISOString() || null],
    );
    reply.status(201).send({ success: true, data: { id } });
  });

  app.put('/cron/:id', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const body = (request.body as {
      name?: string;
      expression?: string;
      handler?: string;
      payload?: Record<string, unknown>;
      enabled?: boolean;
    }) || {};

    const hasOrgColumn = await cronJobsHasOrganizationId(pool);
    const current = await pool.query(
      hasOrgColumn
        ? `SELECT id, expression, handler
           FROM cron_jobs
           WHERE id = $1
             AND organization_id = $2`
        : `SELECT id, expression, handler
           FROM cron_jobs
           WHERE id = $1`,
      hasOrgColumn ? [id, orgId] : [id],
    );
    if (current.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Cron job not found' } });
      return;
    }

    const expression = body.expression ? String(body.expression) : String(current.rows[0].expression);
    const handler = body.handler ? String(body.handler) : String(current.rows[0].handler);
    if (!isValidCron(expression)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Invalid cron expression' },
      });
      return;
    }
    if (!ALLOWED_CRON_HANDLERS.has(handler)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Unsupported cron handler' },
      });
      return;
    }

    const nextRun = computeNextRun(expression, new Date());
    await pool.query(
      hasOrgColumn
        ? `UPDATE cron_jobs
           SET name = COALESCE($2, name),
               expression = $3,
               handler = COALESCE($4, handler),
               payload = COALESCE($5, payload),
               enabled = COALESCE($6, enabled),
               next_run = $7,
               updated_at = NOW()
           WHERE id = $1
             AND organization_id = $8`
        : `UPDATE cron_jobs
           SET name = COALESCE($2, name),
               expression = $3,
               handler = COALESCE($4, handler),
               payload = COALESCE($5, payload),
               enabled = COALESCE($6, enabled),
               next_run = $7,
               updated_at = NOW()
           WHERE id = $1`,
      hasOrgColumn
        ? [
          id,
          body.name || null,
          expression,
          body.handler || null,
          body.payload ? JSON.stringify(body.payload) : null,
          typeof body.enabled === 'boolean' ? body.enabled : null,
          nextRun?.toISOString() || null,
          orgId,
        ]
        : [
          id,
          body.name || null,
          expression,
          body.handler || null,
          body.payload ? JSON.stringify(body.payload) : null,
          typeof body.enabled === 'boolean' ? body.enabled : null,
          nextRun?.toISOString() || null,
        ],
    );
    reply.send({ success: true });
  });

  app.delete('/cron/:id', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const hasOrgColumn = await cronJobsHasOrganizationId(pool);
    const res = await pool.query(
      hasOrgColumn
        ? `DELETE FROM cron_jobs
           WHERE id = $1
             AND organization_id = $2
           RETURNING id`
        : `DELETE FROM cron_jobs
           WHERE id = $1
           RETURNING id`,
      hasOrgColumn ? [id, orgId] : [id],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Cron job not found' } });
      return;
    }
    reply.send({ success: true });
  });

  app.get('/cron/:id/history', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string };
    const limit = parseLimit(query.limit, 50, 1, 200);
    if (limit === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a finite integer between 1 and 200' },
      });
      return;
    }
    const hasOrgColumn = await cronJobsHasOrganizationId(pool);
    const cron = await pool.query(
      hasOrgColumn
        ? `SELECT id
           FROM cron_jobs
           WHERE id = $1
             AND organization_id = $2
           LIMIT 1`
        : `SELECT id
           FROM cron_jobs
           WHERE id = $1
           LIMIT 1`,
      hasOrgColumn ? [id, orgId] : [id],
    );
    if (cron.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Cron job not found' } });
      return;
    }
    const res = await pool.query(
      hasOrgColumn
        ? `SELECT id, cron_job_id, started_at, finished_at, status, error, duration_ms
           FROM cron_job_runs r
           JOIN cron_jobs c
             ON c.id = r.cron_job_id
           WHERE r.cron_job_id = $1
             AND c.organization_id = $2
           ORDER BY started_at DESC
           LIMIT $3`
        : `SELECT id, cron_job_id, started_at, finished_at, status, error, duration_ms
           FROM cron_job_runs
           WHERE cron_job_id = $1
           ORDER BY started_at DESC
           LIMIT $2`,
      hasOrgColumn ? [id, orgId, limit] : [id, limit],
    );
    reply.send({ success: true, data: res.rows });
  });

  app.post('/cron/:id/run', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    try {
      const hasOrgColumn = await cronJobsHasOrganizationId(pool);
      const res = await pool.query(
        hasOrgColumn
          ? `SELECT id, organization_id, name, expression, handler, payload, enabled
             FROM cron_jobs
             WHERE id = $1
               AND organization_id = $2`
          : `SELECT id, NULL::text AS organization_id, name, expression, handler, payload, enabled
             FROM cron_jobs
             WHERE id = $1`,
        hasOrgColumn ? [id, orgId] : [id],
      );
      if (res.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Cron job not found' } });
        return;
      }
      const cronJob = res.rows[0];
      if (cronJob.enabled !== true) {
        reply.status(409).send({
          success: false,
          error: { code: 'CRON_DISABLED', message: 'Cron job is disabled and cannot be run manually' },
        });
        return;
      }
      await executeCronJob(pool, nc, cronJob);
      const nextRun = computeNextRun(String(cronJob.expression), new Date());
      await pool.query(
        `UPDATE cron_jobs
         SET last_run = NOW(),
             next_run = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [String(cronJob.id), nextRun?.toISOString() || null],
      );
      reply.send({ success: true });
    } catch (err) {
      logger.warn('Manual cron run failed', { cron_job_id: id, error: String(err) });
      reply.status(500).send({
        success: false,
        error: { code: 'HANDLER_FAILED', message: 'Cron job execution failed' },
      });
    }
  });

  if (!cronStarted) {
    const tickInterval = parseCronTickIntervalMs(process.env.CRON_TICK_MS);
    if (tickInterval.invalid) {
      logger.error('Invalid CRON_TICK_MS; expected integer in range 1000..3600000 ms', {
        value: process.env.CRON_TICK_MS,
        fallback_interval_ms: tickInterval.intervalMs,
      });
      if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('Invalid CRON_TICK_MS configuration');
      }
    }
    cronStarted = true;
    cronTimer = setInterval(() => {
      void tickCron(pool, nc);
    }, tickInterval.intervalMs);
  }

  app.addHook('onClose', async () => {
    if (cronTimer) {
      clearInterval(cronTimer);
      cronTimer = null;
      cronStarted = false;
    }
  });
}

async function tickCron(pool: pg.Pool, nc: NatsConnection): Promise<void> {
  try {
    const claimLeaseMs = parseCronClaimLeaseMs(process.env.CRON_CLAIM_LEASE_MS);
    const hasOrgColumn = await cronJobsHasOrganizationId(pool);
    const due = await pool.query(
      hasOrgColumn
        ? `WITH due AS (
             SELECT id
             FROM cron_jobs
             WHERE enabled = TRUE
               AND (next_run IS NULL OR next_run <= NOW())
             ORDER BY next_run ASC NULLS FIRST
             LIMIT 25
             FOR UPDATE SKIP LOCKED
           )
           UPDATE cron_jobs c
           SET next_run = NOW() + ($1::text || ' milliseconds')::interval,
               updated_at = NOW()
           FROM due
           WHERE c.id = due.id
           RETURNING c.id, c.organization_id, c.name, c.expression, c.handler, c.payload, c.enabled`
        : `WITH due AS (
             SELECT id
             FROM cron_jobs
             WHERE enabled = TRUE
               AND (next_run IS NULL OR next_run <= NOW())
             ORDER BY next_run ASC NULLS FIRST
             LIMIT 25
             FOR UPDATE SKIP LOCKED
           )
           UPDATE cron_jobs c
           SET next_run = NOW() + ($1::text || ' milliseconds')::interval,
               updated_at = NOW()
           FROM due
           WHERE c.id = due.id
           RETURNING c.id, NULL::text AS organization_id, c.name, c.expression, c.handler, c.payload, c.enabled`,
      [claimLeaseMs],
    );
    for (const row of due.rows) {
      try {
        await executeCronJob(pool, nc, row);
        const nextRun = computeNextRun(String(row.expression), new Date());
        await pool.query(
          `UPDATE cron_jobs
           SET last_run = NOW(),
               next_run = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [String(row.id), nextRun?.toISOString() || null],
        );
      } catch (err) {
        const failureBackoffMs = parseCronFailureBackoffMs(process.env.CRON_FAILURE_BACKOFF_MS);
        const failedNextRun = new Date(Date.now() + failureBackoffMs);
        await pool.query(
          `UPDATE cron_jobs
           SET next_run = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [String(row.id), failedNextRun.toISOString()],
        );
        logger.warn('Cron job execution failed; applied retry backoff', {
          cron_job_id: String(row.id),
          failure_backoff_ms: failureBackoffMs,
          next_run: failedNextRun.toISOString(),
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.warn('Cron tick failed', { error: String(err) });
  }
}

async function executeCronJob(pool: pg.Pool, nc: NatsConnection, row: any): Promise<void> {
  const runId = uuidv7();
  const started = Date.now();
  await pool.query(
    `INSERT INTO cron_job_runs (id, cron_job_id, started_at, status)
     VALUES ($1, $2, NOW(), 'running')`,
    [runId, String(row.id)],
  );

  try {
    const handler = String(row.handler || '');
    const payload = parseJson(row.payload) as Record<string, unknown>;
    await executeHandler(pool, nc, String(row.organization_id || ''), handler, payload);
    await pool.query(
      `UPDATE cron_job_runs
       SET status = 'success', finished_at = NOW(), duration_ms = $2
       WHERE id = $1`,
      [runId, Date.now() - started],
    );
  } catch (err) {
    await pool.query(
      `UPDATE cron_job_runs
       SET status = 'error', finished_at = NOW(), error = $2, duration_ms = $3
       WHERE id = $1`,
      [runId, String(err), Date.now() - started],
    );
    throw err;
  }
}

async function executeHandler(
  pool: pg.Pool,
  nc: NatsConnection,
  organizationId: string,
  handler: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let orgId = String(organizationId || '').trim();
  if (!orgId) {
    orgId = (await resolveFallbackOrganizationId(pool)) || '';
  }
  if (!orgId) {
    throw new Error('cron execution requires organization_id context');
  }

  if (handler === 'health_check') {
    await pool.query('SELECT 1');
    return;
  }

  if (handler === 'backup') {
    const configId = String(payload.config_id || payload.configId || 'default-daily-backup');
    const scheduled = await BackupService.executeScheduledBackupJob(configId);
    const envelope: EventEnvelope<NotifyPushEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'cron.backup.triggered',
        channel: 'outbox',
        title: `Backup scheduler triggered (${scheduled.action})`,
        body: `Scheduled backup handler ran ${scheduled.action} action.`,
        data: { ...payload, config_id: configId, action: scheduled.action, resource_id: scheduled.id },
      },
    };
    nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
    return;
  }

  if (handler === 'rag_reindex') {
    const envelope: EventEnvelope<RagIndexRequestEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        source: String(payload.source || 'cron'),
        source_type: (payload.source_type as RagIndexRequestEvent['source_type']) || 'notes',
        title: String(payload.title || 'Scheduled RAG reindex'),
        content: String(payload.content || 'scheduled reindex'),
        visibility: (payload.visibility as RagIndexRequestEvent['visibility']) || 'global',
      },
    };
    nc.publish(NATS_SUBJECTS.RAG_INDEX_REQUEST, jc.encode(envelope));
    return;
  }

  if (handler === 'digest_generation') {
    const envelope: EventEnvelope<NotifyPushEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'cron.digest',
        channel: 'outbox',
        title: String(payload.title || 'Digest'),
        body: String(payload.body || 'Scheduled digest generated.'),
        data: payload,
      },
    };
    nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
    return;
  }

  if (handler === 'send_message') {
    const chatId = String(payload.chat_id || '');
    const channel = String(payload.channel || '');
    const channelChatId = String(payload.channel_chat_id || '');
    const text = String(payload.text || '');
    if (!chatId || !channel || !channelChatId || !text) {
      throw new Error('send_message requires chat_id, channel, channel_chat_id, text');
    }
    const targetChat = await pool.query(
      `SELECT id
       FROM chats
       WHERE id = $1
         AND organization_id::text = $2::text
         AND channel = $3
         AND channel_chat_id = $4
       LIMIT 1`,
      [chatId, orgId, channel, channelChatId],
    );
    if (targetChat.rows.length === 0) {
      throw new Error('send_message target chat is not authorized for organization');
    }
    await pool.query(
      `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, idempotency_key, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'text', $5, $6, 'pending', NOW(), NOW())`,
      [uuidv7(), chatId, channel, channelChatId, text, `cron:${uuidv7()}`],
    );
    return;
  }

  if (handler === 'run_tool') {
    const toolName = String(payload.tool_name || '');
    const chatId = String(payload.chat_id || '');
    const userId = String(payload.user_id || '');
    if (!toolName || !chatId || !userId) {
      throw new Error('run_tool requires tool_name, chat_id, user_id');
    }
    const authorizedChat = await pool.query(
      `SELECT id
       FROM chats
       WHERE id = $1
         AND organization_id::text = $2::text
       LIMIT 1`,
      [chatId, orgId],
    );
    if (authorizedChat.rows.length === 0) {
      throw new Error('run_tool target chat is not authorized for organization');
    }
    const authorizedUser = await pool.query(
      `SELECT id
       FROM organization_memberships
       WHERE organization_id::text = $1::text
         AND user_id = $2
         AND status = 'active'
       LIMIT 1`,
      [orgId, userId],
    );
    if (authorizedUser.rows.length === 0) {
      throw new Error('run_tool target user is not authorized for organization');
    }
    const correlationId = uuidv7();
    const envelope: EventEnvelope<ToolRunRequestEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        run_id: uuidv7(),
        correlation_id: correlationId,
        tool_name: toolName,
        chat_id: chatId,
        user_id: userId,
        inputs: (payload.inputs as Record<string, unknown>) || {},
        justification: {},
      },
    };
    nc.publish(NATS_SUBJECTS.TOOL_RUN_REQUEST, jc.encode(envelope));
    return;
  }

  if (handler === 'workflow') {
    const workflowId = String(payload.workflow_id || '');
    if (!workflowId) throw new Error('workflow handler requires workflow_id');
    const workflowScope = await pool.query(
      `SELECT w.id
       FROM workflows w
       JOIN chats c ON c.id = w.chat_id
       WHERE w.id = $1
         AND c.organization_id::text = $2::text
       LIMIT 1`,
      [workflowId, orgId],
    );
    if (workflowScope.rows.length === 0) {
      throw new Error('workflow target is not authorized for organization');
    }
    const runId = uuidv7();
    const wf = await pool.query(
      `SELECT COALESCE(MAX(version), 1) AS version
       FROM workflow_versions
       WHERE workflow_id = $1`,
      [workflowId],
    );
    const workflowVersion = wf.rows.length > 0 ? Number(wf.rows[0].version || 1) : 1;
    await pool.query(
      `INSERT INTO workflow_runs (id, workflow_id, workflow_version, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())`,
      [runId, workflowId, workflowVersion],
    );
    publishRuntimeDispatch(nc, {
      kind: 'workflow.execute',
      run_id: runId,
      workflow_id: workflowId,
      workflow_version: workflowVersion,
    });
    return;
  }

  throw new Error(`Unknown cron handler: ${handler}`);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseLimit(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => isValidField(field, i));
}

function isValidField(field: string, index: number): boolean {
  const range = getRange(index);
  const parts = field.split(',');
  for (const part of parts) {
    if (part === '*') continue;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if (!Number.isFinite(step) || step <= 0) return false;
      continue;
    }
    if (/^\d+$/.test(part)) {
      const num = Number(part);
      if (num < range.min || num > range.max) return false;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (a < range.min || b > range.max || a > b) return false;
      continue;
    }
    return false;
  }
  return true;
}

function computeNextRun(expression: string, fromDate: Date): Date | null {
  if (!isValidCron(expression)) return null;
  const [m, h, dom, mon, dow] = expression.trim().split(/\s+/);
  const next = new Date(fromDate.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 366; i += 1) {
    if (
      matchesField(next.getMinutes(), m, 0) &&
      matchesField(next.getHours(), h, 1) &&
      matchesField(next.getDate(), dom, 2) &&
      matchesField(next.getMonth() + 1, mon, 3) &&
      matchesField(next.getDay(), dow, 4)
    ) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  return null;
}

function matchesField(value: number, field: string, index: number): boolean {
  if (field === '*') return true;
  const range = getRange(index);
  for (const part of field.split(',')) {
    if (part === '*') return true;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if ((value - range.min) % step === 0) return true;
      continue;
    }
    if (/^\d+$/.test(part)) {
      if (value === Number(part)) return true;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    }
  }
  return false;
}

function getRange(index: number): { min: number; max: number } {
  if (index === 0) return { min: 0, max: 59 };
  if (index === 1) return { min: 0, max: 23 };
  if (index === 2) return { min: 1, max: 31 };
  if (index === 3) return { min: 1, max: 12 };
  return { min: 0, max: 6 };
}
