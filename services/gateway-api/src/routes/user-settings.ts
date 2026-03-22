import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireRole } from './auth.js';

const USER_OVERRIDABLE_SETTING_KEYS = new Set([
  'search.brave.api_key_ref',
  'notion.api_token_ref',
  'trello.api_key_ref',
  'trello.api_token_ref',
  'x.api_bearer_token_ref',
  'giphy.api_key_ref',
  'tenor.api_key_ref',
  'spotify.client_id',
  'spotify.client_secret_ref',
  'sonos.access_token_ref',
  'shazam.api_token_ref',
  'ha.base_url',
  'ha.token_ref',
  'frigate.base_url',
  'frigate.token_ref',
  'obsidian.vault_path',
]);

const USER_KEY_MODE = 'keys.mode';
const USER_MODE_VALUES = new Set(['org_default', 'personal']);

function normalizeKey(input: unknown): string {
  return String(input || '').trim();
}

function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  }
  return fallback;
}

async function isUserOverrideEnabled(pool: pg.Pool, orgId: string): Promise<boolean> {
  const orgRes = await pool.query(
    `SELECT value
       FROM organization_settings
      WHERE organization_id = $1
        AND key = 'keys.user_override.enabled'
      LIMIT 1`,
    [orgId],
  );
  if (orgRes.rows.length > 0) {
    return parseBooleanSetting(orgRes.rows[0].value, true);
  }

  const globalRes = await pool.query(
    `SELECT value
       FROM settings_global
      WHERE key = 'keys.user_override.enabled'
      LIMIT 1`,
  );
  if (globalRes.rows.length > 0) {
    return parseBooleanSetting(globalRes.rows[0].value, true);
  }
  return true;
}

export async function registerUserSettingsRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  app.get('/v1/me/settings', { preHandler: requireAuth }, async (request: any, reply) => {
    const userId = String(request.userId || '').trim();
    const orgId = String(request.orgId || '').trim();
    if (!userId || !orgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active organization is required' },
      });
    }

    const rawKeys = String((request.query as any)?.keys || '').trim();
    const requestedKeys = rawKeys
      ? rawKeys.split(',').map((entry) => normalizeKey(entry)).filter(Boolean)
      : [];
    const effectiveKeys = requestedKeys.length > 0
      ? requestedKeys.filter((key) => key === USER_KEY_MODE || USER_OVERRIDABLE_SETTING_KEYS.has(key))
      : [USER_KEY_MODE, ...Array.from(USER_OVERRIDABLE_SETTING_KEYS.values())];

    const result = await pool.query(
      `SELECT key, value, updated_at
       FROM user_settings
       WHERE user_id = $1
         AND organization_id = $2
         AND key = ANY($3::text[])
       ORDER BY key ASC`,
      [userId, orgId, effectiveKeys],
    );

    const rowMap = new Map<string, { key: string; value: unknown; updated_at: string | null }>();
    for (const row of result.rows) {
      rowMap.set(String(row.key), {
        key: String(row.key),
        value: row.value,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      });
    }

    const mode = String(rowMap.get(USER_KEY_MODE)?.value || 'org_default').trim();
    const allowPersonalOverride = await isUserOverrideEnabled(pool, orgId);

    const rows = Array.from(rowMap.values())
      .filter((row) => row.key !== USER_KEY_MODE)
      .sort((a, b) => a.key.localeCompare(b.key));

    reply.send({
      success: true,
      data: {
        mode: USER_MODE_VALUES.has(mode) ? mode : 'org_default',
        allow_personal_override: allowPersonalOverride,
        allowed_keys: Array.from(USER_OVERRIDABLE_SETTING_KEYS.values()).sort(),
        rows,
      },
    });
  });

  app.get('/v1/me/settings/:key', { preHandler: requireAuth }, async (request: any, reply) => {
    const userId = String(request.userId || '').trim();
    const orgId = String(request.orgId || '').trim();
    const key = normalizeKey(request.params?.key);
    if (!userId || !orgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active organization is required' },
      });
    }
    if (key !== USER_KEY_MODE && !USER_OVERRIDABLE_SETTING_KEYS.has(key)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Setting key is not available for user scope' },
      });
    }

    const result = await pool.query(
      `SELECT key, value, updated_at
       FROM user_settings
       WHERE user_id = $1
         AND organization_id = $2
         AND key = $3
       LIMIT 1`,
      [userId, orgId, key],
    );

    if (key === USER_KEY_MODE && result.rows.length === 0) {
      return reply.send({
        success: true,
        data: {
          key,
          value: 'org_default',
          updated_at: null,
        },
      });
    }

    const row = result.rows[0];
    if (!row) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Setting key not set for current user' },
      });
    }

    reply.send({
      success: true,
      data: {
        key: String(row.key),
        value: row.value,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      },
    });
  });

  app.put('/v1/me/settings/:key', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          value: {},
        },
        required: ['value'],
      },
    },
  }, async (request: any, reply) => {
    const userId = String(request.userId || '').trim();
    const orgId = String(request.orgId || '').trim();
    const key = normalizeKey(request.params?.key);
    const value = (request.body || {}).value;

    if (!userId || !orgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active organization is required' },
      });
    }

    if (key !== USER_KEY_MODE && !USER_OVERRIDABLE_SETTING_KEYS.has(key)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Setting key is not available for user scope' },
      });
    }

    const allowPersonalOverride = await isUserOverrideEnabled(pool, orgId);
    if (key === USER_KEY_MODE) {
      const mode = String(value || '').trim();
      if (!USER_MODE_VALUES.has(mode)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'keys.mode must be org_default or personal' },
        });
      }
      if (mode === 'personal' && !allowPersonalOverride) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Personal key override is disabled by administrator policy' },
        });
      }
      await pool.query(
        `INSERT INTO user_settings (user_id, organization_id, key, value, updated_at, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, NOW(), $1)
         ON CONFLICT (user_id, organization_id, key)
         DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
        [userId, orgId, key, JSON.stringify(mode)],
      );
      return reply.send({
        success: true,
        data: {
          key,
          value: mode,
        },
      });
    }

    if (!allowPersonalOverride) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Personal key override is disabled by administrator policy' },
      });
    }

    if (value === null) {
      await pool.query(
        `DELETE FROM user_settings
         WHERE user_id = $1
           AND organization_id = $2
           AND key = $3`,
        [userId, orgId, key],
      );
      return reply.send({
        success: true,
        data: { key, deleted: true },
      });
    }

    await pool.query(
      `INSERT INTO user_settings (user_id, organization_id, key, value, updated_at, updated_by)
       VALUES ($1, $2, $3, $4::jsonb, NOW(), $1)
       ON CONFLICT (user_id, organization_id, key)
       DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [userId, orgId, key, JSON.stringify(value)],
    );

    reply.send({
      success: true,
      data: { key, value },
    });
  });
}
