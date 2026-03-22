import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { isUuid } from '../../lib/input-validation.js';
import { getIncidentStatus } from '../../services/IncidentService.js';
import { encryptWebhookSecret } from '../../services/webhook-secret.js';

const WEBHOOK_HANDLERS = new Set(['nats_event', 'workflow', 'agent_message', 'scheduled_task']);
const webhookOrgScopeCache = new WeakMap<pg.Pool, Promise<boolean>>();

function parseOptionalBoolean(raw: unknown): { valid: boolean; value: boolean | undefined } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: raw };
}

async function webhooksAreOrgScoped(pool: pg.Pool): Promise<boolean> {
  let cached = webhookOrgScopeCache.get(pool);
  if (!cached) {
    cached = (async () => {
      const res = await pool.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'webhooks'
            AND column_name = 'organization_id'
          LIMIT 1`,
      );
      return res.rows.length > 0;
    })();
    webhookOrgScopeCache.set(pool, cached);
  }
  return cached;
}

export async function registerAdminWebhookRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.addHook('preHandler', async (request: any, reply) => {
    if (String(request.userRole || '').trim() === 'platform_admin') return;
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

  app.get('/webhooks', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const orgScoped = await webhooksAreOrgScoped(pool);
    const res = await pool.query(
      orgScoped
        ? `SELECT id, name, path, handler, config, enabled, last_received, created_at, updated_at
           FROM webhooks
           WHERE organization_id = $1
           ORDER BY created_at DESC`
        : `SELECT id, name, path, handler, config, enabled, last_received, created_at, updated_at
           FROM webhooks
           ORDER BY created_at DESC`,
      orgScoped ? [orgId] : [],
    );
    reply.send({ success: true, data: res.rows });
  });

  app.post('/webhooks', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const body = (request.body as {
      name?: string;
      path?: string;
      secret?: string;
      handler?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    }) || {};
    const name = String(body.name || '').trim();
    const path = normalizePath(String(body.path || ''));
    const handler = String(body.handler || '').trim();
    const secret = String(body.secret || '').trim();
    const config = normalizeConfig(body.config);
    const enabledParsed = parseOptionalBoolean((body as { enabled?: unknown }).enabled);
    if (!enabledParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
      });
      return;
    }
    const enabled = enabledParsed.value ?? true;
    if (!name || !path || !handler || !secret) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name, path, handler, secret are required' },
      });
      return;
    }
    if (!WEBHOOK_HANDLERS.has(handler)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Unsupported webhook handler' },
      });
      return;
    }
    const configValidationError = validateWebhookConfig(handler, config);
    if (configValidationError) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: configValidationError },
      });
      return;
    }

    const id = uuidv7();
    let encryptedSecret: string;
    try {
      encryptedSecret = encryptWebhookSecret(secret);
    } catch (err) {
      reply.status(503).send({
        success: false,
        error: {
          code: 'WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Webhook secret encryption is unavailable',
        },
      });
      return;
    }
    try {
      await pool.query(
        `INSERT INTO webhooks (id, organization_id, name, path, secret, handler, config, enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [id, orgId, name, path, encryptedSecret, handler, JSON.stringify(config), enabled],
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        reply.status(409).send({
          success: false,
          error: { code: 'WEBHOOK_PATH_CONFLICT', message: 'Webhook path already exists' },
        });
        return;
      }
      throw err;
    }
    reply.status(201).send({ success: true, data: { id } });
  });

  app.put('/webhooks/:id', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const body = (request.body as {
      name?: string;
      path?: string;
      secret?: string | null;
      handler?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    }) || {};
    const path = body.path !== undefined ? normalizePath(String(body.path)) : null;
    if (body.path !== undefined && !path) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'path must be a single non-empty segment' },
      });
      return;
    }
    const existing = await pool.query(
      `SELECT handler, config, secret, enabled
       FROM webhooks
       WHERE id = $1
         AND organization_id = $2`,
      [id, orgId],
    );
    if (existing.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } });
      return;
    }
    let configJson: string | null = null;
    if (body.handler !== undefined || body.config !== undefined) {
      const handler = body.handler !== undefined
        ? String(body.handler || '').trim()
        : String(existing.rows[0].handler || '').trim();
      if (!WEBHOOK_HANDLERS.has(handler)) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'Unsupported webhook handler' },
        });
        return;
      }
      const config = body.config !== undefined
        ? normalizeConfig(body.config)
        : normalizeConfig(existing.rows[0].config);
      const configValidationError = validateWebhookConfig(handler, config);
      if (configValidationError) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: configValidationError },
        });
        return;
      }
      configJson = JSON.stringify(config);
    }
    if (body.secret !== undefined && !String(body.secret || '').trim()) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'secret must be a non-empty string when provided' },
      });
      return;
    }
    let encryptedSecretOverride: string | null = null;
    if (body.secret !== undefined) {
      try {
        encryptedSecretOverride = encryptWebhookSecret(String(body.secret || '').trim());
      } catch (err) {
        reply.status(503).send({
          success: false,
          error: {
            code: 'WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE',
            message: err instanceof Error ? err.message : 'Webhook secret encryption is unavailable',
          },
        });
        return;
      }
    }
    const nextEnabled = typeof body.enabled === 'boolean' ? body.enabled : Boolean(existing.rows[0]?.enabled);
    const effectiveSecret = String(encryptedSecretOverride || existing.rows[0]?.secret || '').trim();
    if (nextEnabled && !effectiveSecret) {
      reply.status(400).send({
        success: false,
        error: { code: 'WEBHOOK_SECRET_REQUIRED', message: 'enabled webhook requires secret' },
      });
      return;
    }
    try {
      const updateRes = await pool.query(
        `UPDATE webhooks
         SET name = COALESCE($2, name),
             path = COALESCE($3, path),
             secret = COALESCE($4::text, secret),
             handler = COALESCE($5, handler),
             config = COALESCE($6, config),
             enabled = COALESCE($7, enabled),
             updated_at = NOW()
         WHERE id = $1
           AND organization_id = $8
         RETURNING id`,
        [
          id,
          body.name || null,
          path,
          encryptedSecretOverride,
          body.handler || null,
          configJson,
          typeof body.enabled === 'boolean' ? body.enabled : null,
          orgId,
        ],
      );
      if (updateRes.rowCount === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } });
        return;
      }
      reply.send({ success: true, data: { id: String(updateRes.rows[0]?.id || id) } });
      return;
    } catch (err: any) {
      if (err?.code === '23505') {
        reply.status(409).send({
          success: false,
          error: { code: 'WEBHOOK_PATH_CONFLICT', message: 'Webhook path already exists' },
        });
        return;
      }
      throw err;
    }
  });

  app.delete('/webhooks/:id', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `DELETE FROM webhooks
       WHERE id = $1
         AND organization_id = $2
       RETURNING id`,
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } });
      return;
    }
    reply.send({ success: true });
  });

  app.get('/webhooks/:id/events', async (request, reply) => {
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
    const parent = await pool.query(
      `SELECT id
       FROM webhooks
       WHERE id = $1
         AND organization_id = $2`,
      [id, orgId],
    );
    if (parent.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } });
      return;
    }
    const res = await pool.query(
      `SELECT e.id, e.webhook_id, e.status, e.payload, e.error, e.created_at
       FROM webhook_events e
       JOIN webhooks w
         ON w.id = e.webhook_id
       WHERE e.webhook_id = $1
         AND w.organization_id = $2
       ORDER BY e.created_at DESC
       LIMIT $3`,
      [id, orgId, limit],
    );
    reply.send({ success: true, data: res.rows });
  });
}

function normalizePath(path: string): string {
  const clean = path.trim().replace(/^\/+/, '');
  if (!clean) return '';
  if (clean.includes('/')) return '';
  if (!/^[a-zA-Z0-9._-]+$/.test(clean)) return '';
  return clean;
}

function normalizeConfig(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeConfig(parsed);
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function validateWebhookConfig(handler: string, config: Record<string, unknown>): string | null {
  if (handler === 'workflow') {
    const workflowId = String(config.workflow_id || '').trim();
    if (!workflowId) return 'workflow handler requires config.workflow_id';
    return null;
  }
  if (handler === 'agent_message') {
    const channel = String(config.channel || '').trim();
    const chatId = String(config.chat_id || '').trim();
    const senderIdentityId = String(config.sender_identity_id || '').trim();
    if (!channel) return 'agent_message handler requires config.channel';
    if (!chatId || !isUuid(chatId)) return 'agent_message handler requires valid config.chat_id';
    if (!senderIdentityId || !isUuid(senderIdentityId)) return 'agent_message handler requires valid config.sender_identity_id';
    const matchMode = String(config.match_mode || '').trim().toLowerCase();
    if (matchMode && matchMode !== 'all' && matchMode !== 'any') {
      return 'agent_message handler config.match_mode must be all or any';
    }
    const template = config.message_template;
    if (template !== undefined) {
      if (typeof template !== 'string' || !template.trim()) {
        return 'agent_message handler config.message_template must be a non-empty string when provided';
      }
      if (template.length > 4000) {
        return 'agent_message handler config.message_template must be 4000 characters or fewer';
      }
    }
    if (config.match_rules !== undefined) {
      if (!Array.isArray(config.match_rules)) {
        return 'agent_message handler config.match_rules must be an array when provided';
      }
      for (const rule of config.match_rules) {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
          return 'agent_message handler config.match_rules entries must be objects';
        }
        const candidate = rule as Record<string, unknown>;
        const path = String(candidate.path || '').trim();
        const op = String(candidate.op || '').trim().toLowerCase();
        if (!path) return 'agent_message handler config.match_rules entries require path';
        if (!/^(equals|not_equals|contains|starts_with|exists|in|gt|gte|lt|lte)$/.test(op)) {
          return 'agent_message handler config.match_rules entries require supported op';
        }
        if (op === 'in' && !Array.isArray(candidate.value)) {
          return 'agent_message handler config.match_rules op=in requires array value';
        }
      }
    }
    return null;
  }
  if (handler === 'scheduled_task') {
    const scheduledTaskId = String(config.scheduled_task_id || '').trim();
    if (!scheduledTaskId || !isUuid(scheduledTaskId)) return 'scheduled_task handler requires valid config.scheduled_task_id';
    const matchMode = String(config.match_mode || '').trim().toLowerCase();
    if (matchMode && matchMode !== 'all' && matchMode !== 'any') {
      return 'scheduled_task handler config.match_mode must be all or any';
    }
    if (config.match_rules !== undefined) {
      if (!Array.isArray(config.match_rules)) {
        return 'scheduled_task handler config.match_rules must be an array when provided';
      }
      for (const rule of config.match_rules) {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
          return 'scheduled_task handler config.match_rules entries must be objects';
        }
        const candidate = rule as Record<string, unknown>;
        const path = String(candidate.path || '').trim();
        const op = String(candidate.op || '').trim().toLowerCase();
        if (!path) return 'scheduled_task handler config.match_rules entries require path';
        if (!/^(equals|not_equals|contains|starts_with|exists|in|gt|gte|lt|lte)$/.test(op)) {
          return 'scheduled_task handler config.match_rules entries require supported op';
        }
        if (op === 'in' && !Array.isArray(candidate.value)) {
          return 'scheduled_task handler config.match_rules op=in requires array value';
        }
      }
    }
    return null;
  }
  if (handler === 'nats_event') {
    const subject = String(config.subject || '').trim();
    if (!subject) return 'nats_event handler requires config.subject';
    if (!/^[^\s]+$/.test(subject)) return 'nats_event handler config.subject must not contain whitespace';
    return null;
  }
  return null;
}

function parseLimit(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}
