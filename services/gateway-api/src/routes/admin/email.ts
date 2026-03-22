import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { GmailService } from '../../services/GmailService.js';
import { getIncidentStatus } from '../../services/IncidentService.js';

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function sendEmailSchemaUnavailable(reply: any, surface: string): void {
  reply.status(503).send({
    success: false,
    error: {
      code: 'FEATURE_UNAVAILABLE',
      message: `Email ${surface} schema not initialized`,
    },
  });
}

function parseEventsLimit(raw: unknown): { ok: true; value: number } | { ok: false } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: 50 };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return { ok: false };
  }
  return { ok: true, value: Math.min(200, parsed) };
}

function resolveGmailPrincipal(raw: unknown): { ok: true; value: 'me' } | { ok: false } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: 'me' };
  return String(raw).trim() === 'me' ? { ok: true, value: 'me' } : { ok: false };
}

export async function registerEmailAdminRoutes(app: FastifyInstance, pool: pg.Pool) {
  const gmail = new GmailService(pool);
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

  app.get('/email/config', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const res = await pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1
         AND key LIKE 'gmail.%'
       ORDER BY key`,
      [orgId],
    );
    reply.send({ success: true, data: res.rows });
  });

  app.put('/email/config', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const body = (request.body || {}) as Record<string, unknown>;
    const updatedBy = String((request as any).userId || (request as any).user?.id || 'system');
    const entries = Object.entries(body).filter(([key]) => key.startsWith('gmail.'));
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, NOW(), $4)
         ON CONFLICT (organization_id, key) DO UPDATE
         SET value = $3::jsonb, updated_at = NOW(), updated_by = $4`,
        [orgId, key, JSON.stringify(value ?? null), updatedBy],
      );
    }
    reply.send({ success: true, data: { updated: entries.map(([k]) => k) } });
  });

  app.get('/email/subscriptions', async (request, reply) => {
    const orgId = String((request as any).orgId);
    try {
      const res = await pool.query(
        `SELECT id, name, pubsub_subscription, handler, config, enabled, last_received, created_at, updated_at
         FROM email_subscriptions
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [orgId],
      );
      reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        reply.send({
          success: true,
          data: [],
          meta: {
            schema_available: false,
            feature_unavailable: 'email subscriptions schema not initialized',
          },
        });
        return;
      }
      throw err;
    }
  });

  app.post('/email/subscriptions', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const body = (request.body || {}) as any;
    const name = String(body.name || '').trim();
    const pubsubSubscription = String(body.pubsub_subscription || '').trim();
    const handler = String(body.handler || '').trim();
    if (!name || !pubsubSubscription || !handler) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name, pubsub_subscription, handler are required' },
      });
      return;
    }
    const id = uuidv7();
    await pool.query(
      `INSERT INTO email_subscriptions (id, organization_id, name, pubsub_subscription, handler, config, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [id, orgId, name, pubsubSubscription, handler, JSON.stringify(body.config || {}), body.enabled !== false],
    );
    reply.status(201).send({ success: true, data: { id } });
  });

  app.put('/email/subscriptions/:id', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const updateRes = await pool.query(
      `UPDATE email_subscriptions
       SET name = COALESCE($2, name),
           pubsub_subscription = COALESCE($3, pubsub_subscription),
           handler = COALESCE($4, handler),
           config = COALESCE($5, config),
           enabled = COALESCE($6, enabled),
           updated_at = NOW()
       WHERE id = $1
         AND organization_id = $7
       RETURNING id, organization_id, name, pubsub_subscription, handler, config, enabled, updated_at`,
      [
        id,
        body.name || null,
        body.pubsub_subscription || null,
        body.handler || null,
        body.config ? JSON.stringify(body.config) : null,
        typeof body.enabled === 'boolean' ? body.enabled : null,
        orgId,
      ],
    );
    if (updateRes.rowCount === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }
    reply.send({ success: true, data: updateRes.rows[0] });
  });

  app.delete('/email/subscriptions/:id', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `DELETE FROM email_subscriptions
       WHERE id = $1
         AND organization_id = $2
       RETURNING id`,
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }
    reply.send({ success: true });
  });

  app.get('/email/subscriptions/:id/events', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const limitResult = parseEventsLimit((request.query as any)?.limit);
    if (!limitResult.ok) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a positive integer when provided' },
      });
      return;
    }
    const limit = limitResult.value;
    try {
      const sub = await pool.query(
        `SELECT id
         FROM email_subscriptions
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1`,
        [id, orgId],
      );
      if (sub.rows.length === 0) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subscription not found' },
        });
        return;
      }

      const res = await pool.query(
        `SELECT e.id, e.subscription_id, e.status, e.payload, e.error, e.created_at
         FROM email_events e
         JOIN email_subscriptions s
           ON s.id = e.subscription_id
         WHERE e.subscription_id = $1
           AND e.organization_id = $2
           AND s.organization_id = $2
         ORDER BY e.created_at DESC
         LIMIT $3`,
        [id, orgId, limit],
      );
      reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendEmailSchemaUnavailable(reply, 'events');
        return;
      }
      throw err;
    }
  });

  app.post('/email/subscriptions/:id/test', async (request, reply) => {
    const orgId = String((request as any).orgId);
    const { id } = request.params as { id: string };
    const payload = (request.body || {}) as Record<string, unknown>;
    const sub = await pool.query(
      `SELECT id FROM email_subscriptions WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [id, orgId],
    );
    if (sub.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }
    try {
      await pool.query(
        `INSERT INTO email_events (id, subscription_id, organization_id, status, payload, error, created_at)
         VALUES ($1, $2, $3, 'success', $4, NULL, NOW())`,
        [uuidv7(), id, orgId, JSON.stringify(payload || { test: true })],
      );
    } catch (error) {
      const code = String((error as { code?: string })?.code || '');
      if (code === '23503') {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subscription not found' },
        });
        return;
      }
      throw error;
    }
    reply.send({ success: true });
  });

  app.get('/email/messages/:messageId', async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const query = (request.query || {}) as Record<string, unknown>;
    const format = String(query.format || 'full');
    const principal = resolveGmailPrincipal(query.user_id);
    if (!principal.ok) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'user_id must be me' },
      });
      return;
    }
    const data = await gmail.getMessage(messageId, format, principal.value);
    reply.send({ success: true, data });
  });

  app.post('/email/messages/:messageId/labels', async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const body = (request.body || {}) as any;
    const principal = resolveGmailPrincipal(body.user_id);
    if (!principal.ok) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'user_id must be me' },
      });
      return;
    }
    const addLabelIds = Array.isArray(body.add_label_ids) ? body.add_label_ids.map(String) : [];
    const removeLabelIds = Array.isArray(body.remove_label_ids) ? body.remove_label_ids.map(String) : [];
    const data = await gmail.patchLabels(messageId, { addLabelIds, removeLabelIds }, principal.value);
    reply.send({ success: true, data });
  });

  app.post('/email/messages/:messageId/archive', async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const body = (request.body || {}) as any;
    const principal = resolveGmailPrincipal(body.user_id);
    if (!principal.ok) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'user_id must be me' },
      });
      return;
    }
    const data = await gmail.archiveMessage(messageId, principal.value);
    reply.send({ success: true, data });
  });
}
