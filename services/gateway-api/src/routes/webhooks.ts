import crypto from 'node:crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, InboundMessageEvent, RuntimeDispatchEvent } from '@sven/shared';
import { withCorrelationMetadata } from '../lib/correlation.js';
import { decryptWebhookSecret } from '../services/webhook-secret.js';

const jc = JSONCodec();
const DEFAULT_WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_WEBHOOK_REPLAY_WINDOW_MS = 10 * 60 * 1000;

// Per-path rate limiting: sliding window, max requests per minute.
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
const WEBHOOK_RATE_LIMIT_MAX = Number(process.env.WEBHOOK_RATE_LIMIT_MAX) || 60;
const webhookRateBuckets = new Map<string, number[]>();

function isWebhookRateLimited(webhookPath: string): boolean {
  const now = Date.now();
  const cutoff = now - WEBHOOK_RATE_LIMIT_WINDOW_MS;
  let timestamps = webhookRateBuckets.get(webhookPath);
  if (!timestamps) {
    timestamps = [];
    webhookRateBuckets.set(webhookPath, timestamps);
  }
  // Prune expired entries.
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }
  if (timestamps.length >= WEBHOOK_RATE_LIMIT_MAX) {
    return true;
  }
  timestamps.push(now);
  return false;
}

// Periodic cleanup of stale buckets to prevent memory growth.
setInterval(() => {
  const now = Date.now();
  const cutoff = now - WEBHOOK_RATE_LIMIT_WINDOW_MS * 2;
  for (const [key, timestamps] of webhookRateBuckets) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
      webhookRateBuckets.delete(key);
    }
  }
}, 5 * 60_000).unref();

function publishRuntimeDispatch(nc: NatsConnection, data: RuntimeDispatchEvent) {
  const event: EventEnvelope<RuntimeDispatchEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data,
  };
  nc.publish(NATS_SUBJECTS.RUNTIME_DISPATCH, jc.encode(event));
}

export async function registerWebhookRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  app.post('/v1/webhooks/:path', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
      },
    },
  }, async (request, reply) => {
    const correlationId = request.correlationId || String(request.id || uuidv7());
    const { path } = request.params as { path: string };
    const key = String(path || '').trim().replace(/^\/+/, '');
    if (isWebhookRateLimited(key)) {
      reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Webhook rate limit exceeded' },
      });
      return;
    }
    const payload = normalizeWebhookPayload(request.body);

    const hookRes = await pool.query(
      `SELECT id, organization_id, path, secret, handler, config, enabled
       FROM webhooks
       WHERE path = $1`,
      [key],
    );
    if (hookRes.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } });
      return;
    }
    if (hookRes.rows.length > 1) {
      reply.status(409).send({
        success: false,
        error: { code: 'AMBIGUOUS_WEBHOOK_PATH', message: 'Webhook path must resolve to exactly one organization-scoped webhook' },
      });
      return;
    }

    const hook = hookRes.rows[0];
    const hookOrganizationId = String(hook.organization_id || '').trim();
    if (!hookOrganizationId) {
      reply.status(503).send({
        success: false,
        error: { code: 'WEBHOOK_ORG_UNAVAILABLE', message: 'Webhook organization scope unavailable' },
      });
      return;
    }
    if (!hook.enabled) {
      reply.status(403).send({ success: false, error: { code: 'DISABLED', message: 'Webhook disabled' } });
      return;
    }
    if (!String(hook.secret || '').trim()) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        { redacted: true, reason: 'missing_webhook_secret' },
        'missing_webhook_secret',
      );
      reply.status(503).send({
        success: false,
        error: { code: 'WEBHOOK_SECRET_REQUIRED', message: 'Webhook secret is required' },
      });
      return;
    }
    let resolvedSecret: string;
    try {
      resolvedSecret = decryptWebhookSecret(String(hook.secret || ''));
    } catch (err) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        { redacted: true, reason: 'webhook_secret_decrypt_failed' },
        'webhook_secret_decrypt_failed',
      );
      reply.status(503).send({
        success: false,
        error: { code: 'WEBHOOK_SECRET_UNAVAILABLE', message: 'Webhook secret could not be resolved' },
      });
      return;
    }
    if (!resolvedSecret) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        { redacted: true, reason: 'missing_webhook_secret' },
        'missing_webhook_secret',
      );
      reply.status(503).send({
        success: false,
        error: { code: 'WEBHOOK_SECRET_REQUIRED', message: 'Webhook secret is required' },
      });
      return;
    }

    const raw = resolveRawWebhookPayload(request);
    if (raw === null) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        { redacted: true, reason: 'raw_body_unavailable' },
        'raw_body_unavailable',
      );
      reply.status(503).send({
        success: false,
        error: { code: 'WEBHOOK_RAW_BODY_REQUIRED', message: 'Raw webhook payload is required for signature verification' },
      });
      return;
    }

    let replayNonce: string | null = null;
    let replayTimestampMs: number | null = null;

    replayNonce = normalizeWebhookNonceHeader(String(request.headers['x-sven-nonce'] || ''));
    replayTimestampMs = parseWebhookTimestampHeader(String(request.headers['x-sven-timestamp'] || ''));
    const maxSkewMs = parsePositiveMs(process.env.WEBHOOK_SIGNATURE_MAX_SKEW_MS, DEFAULT_WEBHOOK_MAX_SKEW_MS);
    const replayWindowMs = parsePositiveMs(
      process.env.WEBHOOK_REPLAY_WINDOW_MS,
      Math.max(maxSkewMs, DEFAULT_WEBHOOK_REPLAY_WINDOW_MS),
    );
    if (!replayNonce || replayTimestampMs === null) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        {
          redacted: true,
          reason: 'missing_freshness_headers',
          has_timestamp: replayTimestampMs !== null,
          has_nonce: Boolean(replayNonce),
          byte_length: Buffer.byteLength(raw, 'utf8'),
        },
        'missing_freshness_headers',
      );
      reply.status(401).send({
        success: false,
        error: { code: 'SIGNATURE_FRESHNESS', message: 'Missing signature freshness headers' },
      });
      return;
    }
    if (Math.abs(Date.now() - replayTimestampMs) > maxSkewMs) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        {
          redacted: true,
          reason: 'stale_timestamp',
          nonce: replayNonce,
          timestamp_ms: replayTimestampMs,
          max_skew_ms: maxSkewMs,
        },
        'stale_timestamp',
      );
      reply.status(401).send({
        success: false,
        error: { code: 'SIGNATURE_FRESHNESS', message: 'Stale signature timestamp' },
      });
      return;
    }

    const signatureHeaderRaw = String(request.headers['x-sven-signature'] || '');
    const signatureHeader = normalizeSignatureHeader(signatureHeaderRaw);
    const expected = crypto
      .createHmac('sha256', resolvedSecret)
      .update(buildWebhookSigningPayload(replayTimestampMs, replayNonce, raw))
      .digest('hex');
    if (!signatureHeader || !safeEqual(signatureHeader, expected)) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        {
          redacted: true,
          byte_length: Buffer.byteLength(raw, 'utf8'),
          nonce: replayNonce,
          timestamp_ms: replayTimestampMs,
        },
        'invalid_signature',
      );
      reply.status(401).send({ success: false, error: { code: 'SIGNATURE', message: 'Invalid signature' } });
      return;
    }

    const replaySeen = await hasWebhookReplayNonce(pool, String(hook.id), replayNonce, replayWindowMs);
    if (replaySeen) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        {
          redacted: true,
          reason: 'replay_detected',
          nonce: replayNonce,
          timestamp_ms: replayTimestampMs,
        },
        'replay_detected',
      );
      reply.status(409).send({ success: false, error: { code: 'REPLAY', message: 'Replay detected' } });
      return;
    }

    try {
      const config = parseJson(hook.config) as Record<string, unknown>;
      await executeWebhookHandler(pool, nc, String(hook.handler), config, payload, correlationId, hookOrganizationId);
      await pool.query(`UPDATE webhooks SET last_received = NOW(), updated_at = NOW() WHERE id = $1`, [hook.id]);
      await logWebhookEvent(
        pool,
        String(hook.id),
        'success',
        withWebhookReplayMetadata(payload, replayNonce, replayTimestampMs),
      );
      reply.send({ success: true });
    } catch (err) {
      await logWebhookEvent(
        pool,
        String(hook.id),
        'error',
        withWebhookReplayMetadata(payload, replayNonce, replayTimestampMs),
        String(err),
      );
      reply.status(500).send({ success: false, error: { code: 'HANDLER_FAILED', message: 'Webhook handler failed' } });
    }
  });
}

async function executeWebhookHandler(
  pool: pg.Pool,
  nc: NatsConnection,
  handler: string,
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
  correlationId: string,
  hookOrganizationId: string,
): Promise<void> {
  if (handler === 'nats_event') {
    const subject = String(config.subject || 'webhook.received');
    const envelope = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        webhook: config.path || '',
        payload,
        organization_id: hookOrganizationId,
        correlation_id: correlationId,
      },
    };
    nc.publish(subject, jc.encode(envelope));
    return;
  }

  if (handler === 'workflow') {
    const workflowId = String(config.workflow_id || '');
    if (!workflowId) throw new Error('workflow handler requires config.workflow_id');
    const wf = await pool.query(
      `SELECT w.version
       FROM workflows
       w
       JOIN chats c
         ON c.id = w.chat_id
       WHERE w.id = $1
         AND c.organization_id::text = $2::text
         AND w.enabled = TRUE
         AND COALESCE(w.is_draft, FALSE) = FALSE
       LIMIT 1`,
      [workflowId, hookOrganizationId],
    );
    if (wf.rows.length === 0) {
      throw new Error('workflow handler requires enabled non-draft workflow');
    }
    const workflowVersion = Number(wf.rows[0].version || 1);
    const runId = uuidv7();
    await pool.query(
      `INSERT INTO workflow_runs (id, workflow_id, workflow_version, status, input_variables, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW())`,
      [runId, workflowId, workflowVersion, JSON.stringify({ webhook_payload: payload })],
    );
    publishRuntimeDispatch(nc, {
      kind: 'workflow.execute',
      run_id: runId,
      workflow_id: workflowId,
      workflow_version: workflowVersion,
    });
    return;
  }

  if (handler === 'agent_message') {
    const channel = String(config.channel || '');
    const chatId = String(config.chat_id || '');
    const senderIdentityId = String(config.sender_identity_id || '');
    if (!channel || !chatId || !senderIdentityId) {
      throw new Error('agent_message handler requires config.channel/chat_id/sender_identity_id');
    }
    const matchRules = parseWebhookMatchRules(config.match_rules);
    const matchMode = parseWebhookMatchMode(config.match_mode);
    if (!webhookPayloadMatchesRules(payload, matchRules, matchMode)) {
      return;
    }
    const text = renderWebhookMessageText(payload, {
      template: String(config.message_template || ''),
      path: String(config.path || ''),
      organizationId: hookOrganizationId,
      correlationId,
    });
    const messageId = uuidv7();

    await pool.query(
      `INSERT INTO messages (id, chat_id, sender_identity_id, role, content_type, text, channel_message_id, created_at)
       VALUES ($1, $2, $3, 'user', 'text', $4, $5, NOW())`,
      [messageId, chatId, senderIdentityId, text, `webhook:${messageId}`],
    );

    const envelope: EventEnvelope<InboundMessageEvent> = {
      schema_version: '1.0',
      event_id: messageId,
      occurred_at: new Date().toISOString(),
      data: {
        channel,
        channel_message_id: `webhook:${messageId}`,
        chat_id: chatId,
        sender_identity_id: senderIdentityId,
        content_type: 'text',
        text,
        metadata: withCorrelationMetadata({ source: 'webhook', payload }, correlationId),
      },
    };
    nc.publish(NATS_SUBJECTS.inboundMessage(channel), jc.encode(envelope));
    return;
  }

  if (handler === 'scheduled_task') {
    const scheduledTaskId = String(config.scheduled_task_id || '').trim();
    if (!scheduledTaskId) {
      throw new Error('scheduled_task handler requires config.scheduled_task_id');
    }
    const matchRules = parseWebhookMatchRules(config.match_rules);
    const matchMode = parseWebhookMatchMode(config.match_mode);
    if (!webhookPayloadMatchesRules(payload, matchRules, matchMode)) {
      return;
    }
    const taskRes = await pool.query(
      `SELECT id, user_id, organization_id, agent_id, chat_id, instruction, max_concurrent_runs, session_retention
       FROM scheduled_tasks
       WHERE id = $1
         AND organization_id = $2
         AND enabled = TRUE
       LIMIT 1`,
      [scheduledTaskId, hookOrganizationId],
    );
    if (taskRes.rows.length === 0) {
      throw new Error('scheduled_task handler requires enabled org-scoped scheduled task');
    }
    const task = taskRes.rows[0];
    const activeRuns = await pool.query(
      `SELECT COUNT(*)::integer AS running_count
       FROM scheduled_task_runs
       WHERE scheduled_task_id = $1
         AND status = 'running'`,
      [scheduledTaskId],
    );
    const runningCount = Number(activeRuns.rows[0]?.running_count || 0);
    const maxConcurrentRuns = Number(task.max_concurrent_runs || 1);
    if (runningCount >= maxConcurrentRuns) {
      return;
    }
    const runId = uuidv7();
    await pool.query(
      `INSERT INTO scheduled_task_runs (id, scheduled_task_id, started_at, status)
       VALUES ($1, $2, NOW(), 'running')`,
      [runId, scheduledTaskId],
    );
    const sessionRetention = String(task.session_retention || 'sticky').trim().toLowerCase() === 'ephemeral'
      ? 'ephemeral'
      : 'sticky';
    const chatId = String(task.chat_id || '').trim() || (
      sessionRetention === 'ephemeral'
        ? `scheduled:${scheduledTaskId}:${runId}`
        : `scheduled:${scheduledTaskId}`
    );
    const envelope: EventEnvelope<{
      type: string;
      organization_id: string;
      chat_id: string;
      user_id: string;
      agent_id?: string;
      text: string;
      source: string;
      scheduled_task_id: string;
    }> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'scheduled_task',
        organization_id: String(task.organization_id || ''),
        chat_id: chatId,
        user_id: String(task.user_id || ''),
        agent_id: String(task.agent_id || '').trim() || undefined,
        text: String(task.instruction || ''),
        source: 'webhook',
        scheduled_task_id: String(task.id || ''),
      },
    };
    nc.publish(NATS_SUBJECTS.inboundMessage('scheduler'), jc.encode(envelope));
    await pool.query(
      `UPDATE scheduled_task_runs
       SET status = 'success', finished_at = NOW(), duration_ms = 0
       WHERE id = $1`,
      [runId],
    );
    return;
  }

  throw new Error(`Unknown webhook handler: ${handler}`);
}

async function logWebhookEvent(
  pool: pg.Pool,
  webhookId: string,
  status: 'success' | 'error',
  payload: Record<string, unknown>,
  error?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO webhook_events (id, webhook_id, status, payload, error, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [uuidv7(), webhookId, status, JSON.stringify(payload || {}), error || null],
  );
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeSignatureHeader(signatureHeaderRaw: string): string {
  const normalized = String(signatureHeaderRaw || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('sha256=')) return normalized.slice('sha256='.length);
  return normalized;
}

function buildWebhookSigningPayload(
  timestampMs: number,
  nonce: string,
  rawPayload: string,
): string {
  return `${timestampMs}.${nonce}.${rawPayload}`;
}

function normalizeWebhookNonceHeader(value: string): string | null {
  const nonce = String(value || '').trim();
  if (!nonce) return null;
  if (nonce.length < 8 || nonce.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(nonce)) return null;
  return nonce;
}

function parseWebhookTimestampHeader(value: string): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // Accept either Unix seconds or milliseconds for compatibility.
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

function parsePositiveMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function hasWebhookReplayNonce(
  pool: pg.Pool,
  webhookId: string,
  nonce: string,
  replayWindowMs: number,
): Promise<boolean> {
  const replayMarker = JSON.stringify({ _sven_replay: { nonce } });
  const replayRes = await pool.query(
    `SELECT 1
       FROM webhook_events
      WHERE webhook_id = $1
        AND payload @> $2::jsonb
        AND created_at >= NOW() - ($3::double precision * INTERVAL '1 millisecond')
      LIMIT 1`,
    [webhookId, replayMarker, replayWindowMs],
  );
  return replayRes.rows.length > 0;
}

function withWebhookReplayMetadata(
  payload: Record<string, unknown>,
  nonce: string | null,
  timestampMs: number | null,
): Record<string, unknown> {
  if (!nonce || timestampMs === null) return payload;
  return {
    ...payload,
    _sven_replay: {
      nonce,
      timestamp_ms: timestampMs,
    },
  };
}

function normalizeWebhookPayload(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

type WebhookMatchRule = {
  path: string;
  op: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'exists' | 'in' | 'gt' | 'gte' | 'lt' | 'lte';
  value?: unknown;
};

function parseWebhookMatchRules(value: unknown): WebhookMatchRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    const path = String(candidate.path || '').trim();
    const op = String(candidate.op || '').trim().toLowerCase() as WebhookMatchRule['op'];
    if (!path || !op) return [];
    return [{ path, op, value: candidate.value }];
  });
}

function parseWebhookMatchMode(value: unknown): 'all' | 'any' {
  return String(value || '').trim().toLowerCase() === 'any' ? 'any' : 'all';
}

function webhookPayloadMatchesRules(
  payload: Record<string, unknown>,
  rules: WebhookMatchRule[],
  mode: 'all' | 'any',
): boolean {
  if (rules.length === 0) return true;
  const results = rules.map((rule) => evaluateWebhookMatchRule(payload, rule));
  return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function evaluateWebhookMatchRule(payload: Record<string, unknown>, rule: WebhookMatchRule): boolean {
  const resolved = getWebhookValueAtPath(payload, rule.path);
  switch (rule.op) {
    case 'exists':
      return resolved !== undefined && resolved !== null;
    case 'equals':
      return compareWebhookPrimitive(resolved, rule.value) === 0;
    case 'not_equals':
      return compareWebhookPrimitive(resolved, rule.value) !== 0;
    case 'contains':
      if (typeof resolved === 'string') return resolved.includes(String(rule.value ?? ''));
      if (Array.isArray(resolved)) return resolved.some((item) => compareWebhookPrimitive(item, rule.value) === 0);
      return false;
    case 'starts_with':
      return typeof resolved === 'string' && resolved.startsWith(String(rule.value ?? ''));
    case 'in':
      return Array.isArray(rule.value) && rule.value.some((candidate) => compareWebhookPrimitive(resolved, candidate) === 0);
    case 'gt':
      return compareWebhookNumbers(resolved, rule.value, (a, b) => a > b);
    case 'gte':
      return compareWebhookNumbers(resolved, rule.value, (a, b) => a >= b);
    case 'lt':
      return compareWebhookNumbers(resolved, rule.value, (a, b) => a < b);
    case 'lte':
      return compareWebhookNumbers(resolved, rule.value, (a, b) => a <= b);
    default:
      return false;
  }
}

function compareWebhookPrimitive(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left === right ? 0 : left < right ? -1 : 1;
  const normalizedLeft = left === null || left === undefined ? '' : String(left);
  const normalizedRight = right === null || right === undefined ? '' : String(right);
  return normalizedLeft === normalizedRight ? 0 : normalizedLeft < normalizedRight ? -1 : 1;
}

function compareWebhookNumbers(
  left: unknown,
  right: unknown,
  predicate: (left: number, right: number) => boolean,
): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
  return predicate(leftNumber, rightNumber);
}

const BLOCKED_PROPERTY_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_WEBHOOK_PATH_DEPTH = 10;

function getWebhookValueAtPath(payload: Record<string, unknown>, path: string): unknown {
  const segments = String(path || '')
    .trim()
    .replace(/^payload\./, '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length > MAX_WEBHOOK_PATH_DEPTH) return undefined;
  let current: unknown = payload;
  for (const segment of segments) {
    if (BLOCKED_PROPERTY_NAMES.has(segment)) return undefined;
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function renderWebhookMessageText(
  payload: Record<string, unknown>,
  options: { template: string; path: string; organizationId: string; correlationId: string },
): string {
  const template = options.template.trim();
  if (!template) return String(payload.text || payload.message || JSON.stringify(payload));
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, token) => {
    const key = String(token || '').trim();
    if (key === 'correlation_id') return options.correlationId;
    if (key === 'webhook.path') return options.path;
    if (key === 'webhook.organization_id') return options.organizationId;
    if (key.startsWith('payload.')) {
      const resolved = getWebhookValueAtPath(payload, key);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    }
    return '';
  });
}

function resolveRawWebhookPayload(request: FastifyRequest): string | null {
  const rawBody: unknown = (request as any).rawBody;
  if (typeof rawBody === 'string') return rawBody;
  if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8');
  return null;
}
