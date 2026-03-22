import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, NotifyPushEvent } from '@sven/shared';

const jc = JSONCodec();

function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return fallback;
}

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function parseOptionalBooleanQuery(value: unknown): { ok: true; value: boolean | null } | { ok: false } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false };
  }
  if (value === 'true') {
    return { ok: true, value: true };
  }
  if (value === 'false') {
    return { ok: true, value: false };
  }
  return { ok: false };
}

function requireGlobalAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '').trim() === 'platform_admin') return true;
  reply.status(403).send({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
  });
  return false;
}

function currentOrgId(request: any): string | null {
  const orgId = String(request.orgId || '').trim();
  return orgId || null;
}

function requireActiveOrg(request: any, reply: any): string | null {
  const orgId = currentOrgId(request);
  if (orgId) return orgId;
  reply.status(403).send({
    success: false,
    error: { code: 'ORG_REQUIRED', message: 'Active account required' },
  });
  return null;
}

const haSubscriptionOrgScopeCache = new WeakMap<pg.Pool, Promise<boolean>>();

async function haSubscriptionsAreOrgScoped(pool: pg.Pool): Promise<boolean> {
  let cached = haSubscriptionOrgScopeCache.get(pool);
  if (!cached) {
    cached = (async () => {
      const res = await pool.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'ha_subscriptions'
            AND column_name = 'organization_id'
          LIMIT 1`,
      );
      return res.rows.length > 0;
    })();
    haSubscriptionOrgScopeCache.set(pool, cached);
  }
  return cached;
}

async function orgProactiveEnabled(pool: pg.Pool, orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  try {
    const scoped = await pool.query(
      `SELECT value
       FROM organization_settings
       WHERE organization_id = $1 AND key = 'agent.proactive.enabled'
       LIMIT 1`,
      [orgId],
    );
    if (scoped.rows.length > 0) {
      return parseBooleanSetting(scoped.rows[0]?.value, false);
    }
    const global = await pool.query(
      `SELECT value
       FROM settings_global
       WHERE key = 'agent.proactive.enabled'
       LIMIT 1`,
    );
    return parseBooleanSetting(global.rows[0]?.value, false);
  } catch (err) {
    if (isSchemaCompatError(err)) return false;
    throw err;
  }
}

async function userChannelOptedIn(pool: pg.Pool, userId: string | null, channel: string): Promise<boolean> {
  if (!userId) return true;
  try {
    const res = await pool.query(
      `SELECT channels
       FROM user_proactive_preferences
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );
    if (res.rows.length === 0) return true;
    const raw = res.rows[0]?.channels;
    let map: Record<string, unknown> = {};
    if (typeof raw === 'string') {
      try { map = JSON.parse(raw); } catch { map = {}; }
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      map = raw as Record<string, unknown>;
    }
    const key = String(channel || 'canvas').trim().toLowerCase() || 'canvas';
    const v = map[key];
    return typeof v === 'boolean' ? v : true;
  } catch (err) {
    if (isSchemaCompatError(err)) return true;
    throw err;
  }
}

function matchesSubscription(
  sub: {
    match_state?: string | null;
    match_attribute?: string | null;
    match_value?: string | null;
    last_state?: string | null;
  },
  state: string,
  attributes: Record<string, unknown>,
): boolean {
  if (!sub.match_state && !sub.match_attribute) {
    return String(sub.last_state || '') !== state;
  }
  if (sub.match_state && sub.match_state !== state) {
    return false;
  }
  if (sub.match_attribute) {
    const attrValue = attributes[sub.match_attribute];
    const targetValue = sub.match_value ?? '';
    return String(attrValue) === String(targetValue);
  }
  return true;
}

export async function registerHaSubscriptionRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  // ─── GET /ha/subscriptions ───
  app.get('/ha/subscriptions', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const { enabled, entity_id } = request.query as { enabled?: string; entity_id?: string };

    const enabledFilter = parseOptionalBooleanQuery(enabled);
    if (!enabledFilter.ok) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled query must be true or false when provided' },
      });
      return;
    }
    const enabledValue = enabledFilter.value;

    const orgScoped = await haSubscriptionsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `SELECT s.id, s.chat_id, s.user_id, s.entity_id, s.match_state, s.match_attribute, s.match_value,
                  s.cooldown_seconds, s.enabled, s.last_state, s.last_attributes, s.last_notified_at, s.created_at, s.updated_at
             FROM ha_subscriptions s
            WHERE s.organization_id = $1
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = s.chat_id
                   AND c.organization_id = $1
              )
              AND ($2::boolean IS NULL OR s.enabled = $2)
              AND ($3::text IS NULL OR s.entity_id = $3)
            ORDER BY s.created_at DESC`
        : `SELECT s.id, s.chat_id, s.user_id, s.entity_id, s.match_state, s.match_attribute, s.match_value,
                  s.cooldown_seconds, s.enabled, s.last_state, s.last_attributes, s.last_notified_at, s.created_at, s.updated_at
             FROM ha_subscriptions s
            WHERE EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = s.chat_id
                   AND c.organization_id = $1
              )
              AND ($2::boolean IS NULL OR s.enabled = $2)
              AND ($3::text IS NULL OR s.entity_id = $3)
            ORDER BY s.created_at DESC`,
      [orgId, enabledValue, entity_id ?? null],
    );

    reply.send({ success: true, data: result.rows });
  });

  // ─── POST /ha/subscriptions ───
  app.post('/ha/subscriptions', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const body = request.body as {
      chat_id?: string;
      user_id?: string;
      entity_id?: string;
      match_state?: string | null;
      match_attribute?: string | null;
      match_value?: string | null;
      cooldown_seconds?: number;
      enabled?: boolean;
    } | null;

    if (!body?.chat_id || !body.entity_id) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'chat_id and entity_id are required' },
      });
      return;
    }
    const chat = await pool.query(
      `SELECT 1
       FROM chats
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1`,
      [body.chat_id, orgId],
    );
    if (chat.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found in active account' },
      });
      return;
    }

    const cooldown = typeof body.cooldown_seconds === 'number'
      ? Math.min(Math.max(body.cooldown_seconds, 0), 86400)
      : 300;

    const orgScoped = await haSubscriptionsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `INSERT INTO ha_subscriptions (
              id, organization_id, chat_id, user_id, entity_id, match_state, match_attribute, match_value,
              cooldown_seconds, enabled, created_at, updated_at
           ) VALUES (
              uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
           )
           RETURNING id, chat_id, user_id, entity_id, match_state, match_attribute, match_value,
                     cooldown_seconds, enabled, last_state, last_attributes, last_notified_at, created_at, updated_at`
        : `INSERT INTO ha_subscriptions (
              id, chat_id, user_id, entity_id, match_state, match_attribute, match_value,
              cooldown_seconds, enabled, created_at, updated_at
           ) VALUES (
              uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
           )
           RETURNING id, chat_id, user_id, entity_id, match_state, match_attribute, match_value,
                     cooldown_seconds, enabled, last_state, last_attributes, last_notified_at, created_at, updated_at`,
      orgScoped
        ? [
            orgId,
            body.chat_id,
            body.user_id ?? null,
            body.entity_id,
            body.match_state ?? null,
            body.match_attribute ?? null,
            body.match_value ?? null,
            cooldown,
            body.enabled ?? true,
          ]
        : [
            body.chat_id,
            body.user_id ?? null,
            body.entity_id,
            body.match_state ?? null,
            body.match_attribute ?? null,
            body.match_value ?? null,
            cooldown,
            body.enabled ?? true,
          ],
    );

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── PUT /ha/subscriptions/:id ───
  app.put('/ha/subscriptions/:id', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const body = request.body as {
      match_state?: string | null;
      match_attribute?: string | null;
      match_value?: string | null;
      cooldown_seconds?: number;
      enabled?: boolean;
    } | null;

    const cooldown = typeof body?.cooldown_seconds === 'number'
      ? Math.min(Math.max(body.cooldown_seconds, 0), 86400)
      : null;

    const orgScoped = await haSubscriptionsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `UPDATE ha_subscriptions
             SET match_state = COALESCE($2, match_state),
                 match_attribute = COALESCE($3, match_attribute),
                 match_value = COALESCE($4, match_value),
                 cooldown_seconds = COALESCE($5, cooldown_seconds),
                 enabled = COALESCE($6, enabled),
                 updated_at = NOW()
            WHERE ha_subscriptions.id = $1
              AND ha_subscriptions.organization_id = $7
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = ha_subscriptions.chat_id
                   AND c.organization_id = $7
              )
            RETURNING ha_subscriptions.id AS id,
                      ha_subscriptions.chat_id AS chat_id,
                      ha_subscriptions.user_id AS user_id,
                      ha_subscriptions.entity_id AS entity_id,
                      ha_subscriptions.match_state AS match_state,
                      ha_subscriptions.match_attribute AS match_attribute,
                      ha_subscriptions.match_value AS match_value,
                      ha_subscriptions.cooldown_seconds AS cooldown_seconds,
                      ha_subscriptions.enabled AS enabled,
                      ha_subscriptions.last_state AS last_state,
                      ha_subscriptions.last_attributes AS last_attributes,
                      ha_subscriptions.last_notified_at AS last_notified_at,
                      ha_subscriptions.created_at AS created_at,
                      ha_subscriptions.updated_at AS updated_at`
        : `UPDATE ha_subscriptions
             SET match_state = COALESCE($2, match_state),
                 match_attribute = COALESCE($3, match_attribute),
                 match_value = COALESCE($4, match_value),
                 cooldown_seconds = COALESCE($5, cooldown_seconds),
                 enabled = COALESCE($6, enabled),
                 updated_at = NOW()
            WHERE ha_subscriptions.id = $1
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = ha_subscriptions.chat_id
                   AND c.organization_id = $7
              )
            RETURNING ha_subscriptions.id AS id,
                      ha_subscriptions.chat_id AS chat_id,
                      ha_subscriptions.user_id AS user_id,
                      ha_subscriptions.entity_id AS entity_id,
                      ha_subscriptions.match_state AS match_state,
                      ha_subscriptions.match_attribute AS match_attribute,
                      ha_subscriptions.match_value AS match_value,
                      ha_subscriptions.cooldown_seconds AS cooldown_seconds,
                      ha_subscriptions.enabled AS enabled,
                      ha_subscriptions.last_state AS last_state,
                      ha_subscriptions.last_attributes AS last_attributes,
                      ha_subscriptions.last_notified_at AS last_notified_at,
                      ha_subscriptions.created_at AS created_at,
                      ha_subscriptions.updated_at AS updated_at`,
      [
        id,
        body?.match_state ?? null,
        body?.match_attribute ?? null,
        body?.match_value ?? null,
        cooldown,
        body?.enabled ?? null,
        orgId,
      ],
    );

    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subscription not found' },
      });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── DELETE /ha/subscriptions/:id ───
  app.delete('/ha/subscriptions/:id', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const orgScoped = await haSubscriptionsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `DELETE FROM ha_subscriptions s
             USING chats c
            WHERE s.id = $1
              AND s.organization_id = $2
              AND c.id = s.chat_id
              AND c.organization_id = $2
            RETURNING s.id`
        : `DELETE FROM ha_subscriptions s
             USING chats c
            WHERE s.id = $1
              AND c.id = s.chat_id
              AND c.organization_id = $2
            RETURNING s.id`,
      [id, orgId],
    );

    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subscription not found' },
      });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── POST /ha/subscriptions/:id/simulate ───
  app.post('/ha/subscriptions/:id/simulate', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const body = request.body as {
      state?: string;
      attributes?: Record<string, unknown>;
      force?: boolean;
    } | null;
    const state = String(body?.state || '').trim();
    const attributes = (body?.attributes && typeof body.attributes === 'object')
      ? body.attributes
      : {};
    if (body?.force !== undefined && typeof body.force !== 'boolean') {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'force must be a boolean when provided' },
      });
      return;
    }
    const forceNotify = body?.force === true;

    if (!state) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'state is required' },
      });
      return;
    }

    const orgScoped = await haSubscriptionsAreOrgScoped(pool);
    const row = await pool.query(
      orgScoped
        ? `SELECT s.id, s.chat_id, s.user_id, s.entity_id, s.match_state, s.match_attribute, s.match_value,
                  s.cooldown_seconds, s.enabled, s.last_state, s.last_attributes, s.last_notified_at, s.created_at, s.updated_at
             FROM ha_subscriptions s
            WHERE s.id = $1
              AND s.organization_id = $2
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = s.chat_id
                   AND c.organization_id = $2
              )`
        : `SELECT s.id, s.chat_id, s.user_id, s.entity_id, s.match_state, s.match_attribute, s.match_value,
                  s.cooldown_seconds, s.enabled, s.last_state, s.last_attributes, s.last_notified_at, s.created_at, s.updated_at
             FROM ha_subscriptions s
            WHERE s.id = $1
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = s.chat_id
                   AND c.organization_id = $2
              )`,
      [id, orgId],
    );
    if (row.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subscription not found' },
      });
      return;
    }
    const sub = row.rows[0] as {
      id: string;
      chat_id: string;
      user_id: string | null;
      entity_id: string;
      match_state: string | null;
      match_attribute: string | null;
      match_value: string | null;
      cooldown_seconds: number;
      enabled: boolean;
      last_state: string | null;
      last_notified_at: string | null;
    };
    if (!sub.enabled) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Subscription is disabled' },
      });
      return;
    }

    const now = Date.now();
    const lastNotified = sub.last_notified_at ? Date.parse(sub.last_notified_at) : 0;
    const cooldownMs = (sub.cooldown_seconds || 0) * 1000;
    const isCooldown = cooldownMs > 0 && now - lastNotified < cooldownMs;
    const matched = matchesSubscription(sub, state, attributes);
    const shouldNotify = forceNotify || (matched && !isCooldown);
    let canNotify = shouldNotify;
    let suppressedReason: string | null = null;
    if (shouldNotify) {
      const orgRes = await pool.query(
        `SELECT organization_id, channel
         FROM chats
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1`,
        [sub.chat_id, orgId],
      );
      const chatOrgId = String(orgRes.rows[0]?.organization_id || '');
      const channel = String(orgRes.rows[0]?.channel || 'canvas');
      const enabled = await orgProactiveEnabled(pool, chatOrgId || null);
      if (!enabled) {
        canNotify = false;
        suppressedReason = 'admin_disabled';
      } else {
        const optedIn = await userChannelOptedIn(pool, sub.user_id, channel);
        if (!optedIn) {
          canNotify = false;
          suppressedReason = 'channel_opted_out';
        }
      }
    }

    await pool.query(
      orgScoped
        ? `UPDATE ha_subscriptions
             SET last_state = $2,
                 last_attributes = $3::jsonb,
                 last_notified_at = CASE WHEN $4 THEN NOW() ELSE last_notified_at END,
                 updated_at = NOW()
           WHERE id = $1
             AND organization_id = $5`
        : `UPDATE ha_subscriptions
             SET last_state = $2,
                 last_attributes = $3::jsonb,
                 last_notified_at = CASE WHEN $4 THEN NOW() ELSE last_notified_at END,
                 updated_at = NOW()
           WHERE id = $1`,
      orgScoped ? [id, state, JSON.stringify(attributes), canNotify, orgId] : [id, state, JSON.stringify(attributes), canNotify],
    );

    if (canNotify) {
      const title = `HA alert: ${sub.entity_id}`;
      const messageBody = sub.match_attribute
        ? `${sub.match_attribute} is ${attributes[sub.match_attribute]}`
        : `State is ${state}`;
      const envelope: EventEnvelope<NotifyPushEvent> = {
        schema_version: '1.0',
        event_id: uuidv7(),
        occurred_at: new Date().toISOString(),
        data: {
          type: 'ha.subscription',
          recipient_user_id: sub.user_id || undefined,
          channel: 'outbox',
          title,
          body: messageBody,
          data: {
            chat_id: sub.chat_id,
            entity_id: sub.entity_id,
            state,
            attributes,
            source: 'ha.subscription.simulate',
          },
        },
      };
      try {
        nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
      } catch {
        // Keep simulation deterministic even if NATS publish fails.
      }
    }

    reply.send({
      success: true,
      data: {
        id: sub.id,
        entity_id: sub.entity_id,
        matched,
        cooldown_active: isCooldown && !body?.force,
        notified: canNotify,
        suppressed_reason: suppressedReason,
      },
    });
  });
}
