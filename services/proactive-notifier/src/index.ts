// ---------------------------------------------------------------------------
// Proactive Notifier Service — Entry Point
// ---------------------------------------------------------------------------
// Standalone service for autonomous proactive notifications: trigger rule
// evaluation, channel dispatch, rate limiting, quiet hours, adaptive
// suppression, and user feedback integration with Postgres persistence
// and NATS event streaming.
//
// Port: 9475 (configurable via PROACTIVE_PORT)
// Dependencies: Postgres, NATS
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect } from 'nats';
import { createLogger } from '@sven/shared';
import crypto from 'node:crypto';

import { ProactiveEngine } from '@sven/proactive-notifier/engine';
import { DEFAULT_TRIGGER_RULES, type TriggerCategory, type NotificationSeverity } from '@sven/proactive-notifier/triggers';
import type { ChannelType } from '@sven/proactive-notifier/channels';

import { PgTriggerRuleStore } from './store/pg-trigger-rule-store.js';
import { PgChannelEndpointStore } from './store/pg-channel-endpoint-store.js';
import { PgNotificationLogStore } from './store/pg-notification-log-store.js';
import { ProactivePublisher } from './nats/publisher.js';
import { ProactiveSubscriber } from './nats/subscriber.js';

const logger = createLogger('proactive-notifier-service');

// Bridge @sven/shared logger (typed string,Record) to engine/subscriber
// logger interface (variadic unknown[])
const engineLogger = {
  info: (...args: unknown[]) => logger.info(String(args[0]), args[1] as Record<string, unknown> | undefined),
  warn: (...args: unknown[]) => logger.warn(String(args[0]), args[1] as Record<string, unknown> | undefined),
  error: (...args: unknown[]) => logger.error(String(args[0]), args[1] as Record<string, unknown> | undefined),
};

/* ─── Configuration ──────────────────────────────────────────────────── */

const PORT = parseInt(process.env.PROACTIVE_PORT || '9475', 10);
const HOST = process.env.PROACTIVE_HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

/* ─── Bootstrap ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // ── Postgres ──
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    logger.error('Postgres pool error', { error: err.message });
  });

  const client = await pool.connect();
  client.release();
  logger.info('Postgres connected');

  // ── NATS ──
  const nc = await connect({ servers: NATS_URL });
  logger.info('NATS connected', { server: NATS_URL });

  // ── Stores ──
  const ruleStore = new PgTriggerRuleStore(pool);
  const endpointStore = new PgChannelEndpointStore(pool);
  const logStore = new PgNotificationLogStore(pool);

  // ── Seed default trigger rules ──
  const seedRules = DEFAULT_TRIGGER_RULES.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    organization_id: null,
  }));
  const seeded = await ruleStore.seedDefaults(seedRules);
  if (seeded > 0) {
    logger.info('Seeded default trigger rules', { count: seeded });
  }

  // ── Engine + Publisher + Subscriber ──
  const engine = new ProactiveEngine(pool, nc, engineLogger);
  await engine.reload();

  const publisher = new ProactivePublisher(nc);
  const subscriber = new ProactiveSubscriber(nc, engine, engineLogger);
  subscriber.start();

  publisher.publishEngineReloaded(engine.getRules().length, engine.getEndpoints().length, engine.getConfig().enabled);

  // ── Fastify ──
  const app = Fastify({ logger: false });

  // ── Health Endpoints ──────────────────────────────────────────────────

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'proactive-notifier',
    uptime: process.uptime(),
  }));

  app.get('/readyz', async (_req, reply) => {
    try {
      const pgCheck = await pool.query('SELECT 1');
      const natsOk = nc.isClosed() ? 'fail' : 'ok';
      const status = pgCheck.rows.length > 0 && natsOk === 'ok' ? 'ok' : 'degraded';
      return {
        status,
        checks: {
          postgres: pgCheck.rows.length > 0 ? 'ok' : 'fail',
          nats: natsOk,
          engine_rules: engine.getRules().length,
          engine_endpoints: engine.getEndpoints().length,
          engine_enabled: engine.getConfig().enabled,
        },
      };
    } catch {
      return reply.status(503).send({ status: 'down', checks: { postgres: 'fail', nats: 'unknown' } });
    }
  });

  // ── Engine Config Routes ──────────────────────────────────────────────

  app.get('/v1/proactive/config', async () => ({
    success: true,
    data: engine.getConfig(),
  }));

  app.put('/v1/proactive/config', async (request) => {
    const body = request.body as Record<string, unknown>;

    // Update config in settings_global
    await pool.query(
      `INSERT INTO settings_global (key, value, updated_at)
       VALUES ('proactive_notifications.config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(body)],
    );

    await engine.reload();
    publisher.publishEngineReloaded(engine.getRules().length, engine.getEndpoints().length, engine.getConfig().enabled);

    return { success: true, data: engine.getConfig() };
  });

  app.post('/v1/proactive/reload', async () => {
    await engine.reload();
    publisher.publishEngineReloaded(engine.getRules().length, engine.getEndpoints().length, engine.getConfig().enabled);
    return { success: true, message: 'Engine reloaded' };
  });

  // ── Trigger Rule CRUD ─────────────────────────────────────────────────

  app.get('/v1/proactive/rules', async (request) => {
    const query = request.query as Record<string, string>;
    const rules = await ruleStore.list({
      category: query.category as TriggerCategory | undefined,
      enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
      orgId: query.org_id,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
    return { success: true, data: rules };
  });

  app.get<{ Params: { id: string } }>('/v1/proactive/rules/:id', async (request, reply) => {
    const rule = await ruleStore.getById(request.params.id);
    if (!rule) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
    return { success: true, data: rule };
  });

  app.post('/v1/proactive/rules', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const name = body.name as string;
    const category = body.category as TriggerCategory;

    if (!name || !category) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name and category required' } });
    }

    const rule = {
      id: crypto.randomUUID(),
      name,
      category,
      enabled: body.enabled !== false,
      min_severity: (body.min_severity as NotificationSeverity) || 'warning',
      cooldown_seconds: (body.cooldown_seconds as number) ?? 300,
      max_per_hour: (body.max_per_hour as number) ?? 10,
      condition_expression: (body.condition_expression as string) || 'true',
      body_template: (body.body_template as string) || `⚡ **${name}**: {{event.message}}`,
      target_channels: (body.target_channels as string[]) || [],
      organization_id: (body.organization_id as string) || null,
    };

    await ruleStore.create(rule);
    await engine.reload();
    publisher.publishRuleCreated(rule.id, rule.category, rule.name);

    return reply.status(201).send({ success: true, data: rule });
  });

  app.patch<{ Params: { id: string } }>('/v1/proactive/rules/:id', async (request, reply) => {
    const existing = await ruleStore.getById(request.params.id);
    if (!existing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });

    const body = request.body as Record<string, unknown>;
    await ruleStore.update(request.params.id, {
      name: body.name as string | undefined,
      enabled: body.enabled as boolean | undefined,
      min_severity: body.min_severity as NotificationSeverity | undefined,
      cooldown_seconds: body.cooldown_seconds as number | undefined,
      max_per_hour: body.max_per_hour as number | undefined,
      condition_expression: body.condition_expression as string | undefined,
      body_template: body.body_template as string | undefined,
      target_channels: body.target_channels as string[] | undefined,
    });

    await engine.reload();
    const updated = await ruleStore.getById(request.params.id);
    return { success: true, data: updated };
  });

  app.delete<{ Params: { id: string } }>('/v1/proactive/rules/:id', async (request) => {
    await ruleStore.delete(request.params.id);
    await engine.reload();
    return { success: true };
  });

  // ── Channel Endpoint CRUD ─────────────────────────────────────────────

  app.get('/v1/proactive/endpoints', async (request) => {
    const query = request.query as Record<string, string>;
    const endpoints = await endpointStore.list({
      channel: query.channel as ChannelType | undefined,
      enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
      orgId: query.org_id,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
    return { success: true, data: endpoints };
  });

  app.get<{ Params: { id: string } }>('/v1/proactive/endpoints/:id', async (request, reply) => {
    const endpoint = await endpointStore.getById(request.params.id);
    if (!endpoint) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
    return { success: true, data: endpoint };
  });

  app.post('/v1/proactive/endpoints', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const channel = body.channel as ChannelType;
    const channelChatId = body.channel_chat_id as string;
    const label = body.label as string;

    if (!channel || !channelChatId || !label) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel, channel_chat_id, and label required' } });
    }

    const endpoint = {
      id: crypto.randomUUID(),
      channel,
      channel_chat_id: channelChatId,
      label,
      enabled: body.enabled !== false,
      min_severity: (body.min_severity as NotificationSeverity) || 'info',
      organization_id: (body.organization_id as string) || null,
    };

    await endpointStore.create(endpoint);
    await engine.reload();
    publisher.publishEndpointCreated(endpoint.id, endpoint.channel, endpoint.label);

    return reply.status(201).send({ success: true, data: endpoint });
  });

  app.patch<{ Params: { id: string } }>('/v1/proactive/endpoints/:id', async (request, reply) => {
    const existing = await endpointStore.getById(request.params.id);
    if (!existing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });

    const body = request.body as Record<string, unknown>;
    await endpointStore.update(request.params.id, {
      label: body.label as string | undefined,
      enabled: body.enabled as boolean | undefined,
      min_severity: body.min_severity as NotificationSeverity | undefined,
      channel_chat_id: body.channel_chat_id as string | undefined,
    });

    await engine.reload();
    const updated = await endpointStore.getById(request.params.id);
    return { success: true, data: updated };
  });

  app.delete<{ Params: { id: string } }>('/v1/proactive/endpoints/:id', async (request) => {
    await endpointStore.delete(request.params.id);
    await engine.reload();
    return { success: true };
  });

  // ── Notification Log & Stats ──────────────────────────────────────────

  app.get('/v1/proactive/log', async (request) => {
    const query = request.query as Record<string, string>;
    const entries = await logStore.list({
      status: query.status,
      category: query.category,
      ruleId: query.rule_id,
      orgId: query.org_id,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return { success: true, data: entries };
  });

  app.get<{ Params: { id: string } }>('/v1/proactive/log/:id', async (request, reply) => {
    const entry = await logStore.getById(request.params.id);
    if (!entry) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Log entry not found' } });
    return { success: true, data: entry };
  });

  app.get('/v1/proactive/stats', async (request) => {
    const query = request.query as Record<string, string>;
    const stats = await logStore.stats({
      orgId: query.org_id,
      hoursBack: query.hours ? parseInt(query.hours, 10) : undefined,
    });
    return { success: true, data: stats };
  });

  // ── Feedback Endpoint ─────────────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/v1/proactive/log/:id/feedback', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const action = body.action as 'acknowledged' | 'dismissed' | 'muted_rule';

    if (!action || !['acknowledged', 'dismissed', 'muted_rule'].includes(action)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'action must be acknowledged, dismissed, or muted_rule' } });
    }

    const entry = await logStore.getById(request.params.id);
    if (!entry) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Log entry not found' } });

    await engine.recordFeedback(request.params.id, action);
    publisher.publishFeedbackRecorded(request.params.id, action);

    return { success: true, message: `Feedback '${action}' recorded` };
  });

  // ── Freeform Proactive Message ────────────────────────────────────────

  app.post('/v1/proactive/send', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    const category = (body.category as TriggerCategory) || 'custom';
    const severity = (body.severity as NotificationSeverity) || 'info';

    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }

    const result = await engine.sendFreeform({
      text,
      severity,
      category,
      target_channel_ids: (body.target_channel_ids as string[]) ?? undefined,
      organization_id: (body.organization_id as string) ?? null,
    });

    if (result.suppressed) {
      return { success: false, data: result };
    }

    return { success: true, data: result };
  });

  // ── Test Evaluation (dry-run) ─────────────────────────────────────────

  app.post('/v1/proactive/test', async (request) => {
    const body = request.body as Record<string, unknown>;

    const event = {
      event_id: (body.event_id as string) || crypto.randomUUID(),
      occurred_at: (body.occurred_at as string) || new Date().toISOString(),
      category: (body.category as TriggerCategory) || 'custom',
      severity: (body.severity as NotificationSeverity) || 'info',
      data: (body.data as Record<string, unknown>) || {},
      organization_id: (body.organization_id as string) || null,
    };

    const result = await engine.evaluate(event);

    return {
      success: true,
      data: {
        would_notify: result.should_notify,
        suppression_reason: result.suppression_reason,
        matched_rules: result.matched_rules.map((r) => ({ id: r.id, name: r.name, category: r.category })),
        payload_count: result.payloads.length,
      },
    };
  });

  // ── Startup ───────────────────────────────────────────────────────────

  await app.listen({ host: HOST, port: PORT });
  logger.info('Proactive Notifier service started', { host: HOST, port: PORT });

  // ── Graceful Shutdown ─────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    logger.info('Shutdown signal received', { signal });
    await subscriber.stop();
    await app.close();
    await nc.drain();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
