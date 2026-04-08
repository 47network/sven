import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { resolveSecretRef } from '@sven/shared';

function parseSettingValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function parseSettingText(value: unknown): string {
  const parsed = parseSettingValue<string>(value);
  return typeof parsed === 'string' ? parsed.trim() : '';
}

const SECRET_REF_ALLOWED_SCHEMES = new Set(['env', 'vault', 'sops']);
const SECRET_REF_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([A-Za-z0-9._/-]{1,160})$/;

function isValidSecretRef(value: string): boolean {
  const trimmed = String(value || '').trim();
  const match = SECRET_REF_PATTERN.exec(trimmed);
  if (!match) return false;
  return SECRET_REF_ALLOWED_SCHEMES.has(match[1].toLowerCase());
}

function secretRefScheme(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  const match = SECRET_REF_PATTERN.exec(trimmed);
  if (!match) return null;
  return match[1].toLowerCase();
}

export function defaultHaDangerTier(entityId: string): number {
  const domain = String(entityId || '').trim().toLowerCase().split('.')[0] || '';
  const criticalDomains = new Set(['lock', 'alarm_control_panel', 'cover', 'garage_door']);
  const elevatedDomains = new Set(['climate', 'fan', 'remote', 'media_player', 'vacuum']);
  if (criticalDomains.has(domain)) return 3;
  if (elevatedDomains.has(domain)) return 2;
  return 1;
}

async function resolveHaConfig(pool: pg.Pool, orgId: string | null): Promise<{
  baseUrl: string | null;
  tokenRef: string | null;
}> {
  const keys = ['ha.base_url', 'ha.token_ref'];
  const settings = new Map<string, unknown>();
  if (orgId) {
    const scoped = await pool.query(
      `SELECT key, value FROM organization_settings WHERE organization_id = $1 AND key = ANY($2::text[])`,
      [orgId, keys],
    );
    for (const row of scoped.rows) settings.set(String(row.key), row.value);
  }
  const missing = keys.filter((key) => !settings.has(key));
  if (missing.length > 0) {
    const fallback = await pool.query(
      `SELECT key, value FROM settings_global WHERE key = ANY($1::text[])`,
      [missing],
    );
    for (const row of fallback.rows) settings.set(String(row.key), row.value);
  }
  const baseUrl = parseSettingText(settings.get('ha.base_url'));
  const tokenRef = parseSettingText(settings.get('ha.token_ref'));
  return {
    baseUrl: baseUrl || null,
    tokenRef: tokenRef || null,
  };
}

async function resolveHaBearerToken(tokenRef: string | null): Promise<string> {
  const raw = String(tokenRef || '').trim();
  if (!raw) return '';
  if (!isValidSecretRef(raw)) return '';
  try {
    return String(await resolveSecretRef(raw)).trim();
  } catch {
    return '';
  }
}

export async function registerHaRoutes(app: FastifyInstance, pool: pg.Pool) {
  // ─── GET /ha/config ───
  app.get('/ha/config', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    const config = await resolveHaConfig(pool, orgId);
    const token = await resolveHaBearerToken(config.tokenRef);
    const tokenRefPresent = Boolean(config.tokenRef);
    const tokenRefScheme = secretRefScheme(config.tokenRef);
    const tokenResolved = Boolean(token);

    reply.send({
      success: true,
      data: {
        base_url: config.baseUrl,
        token_ref_present: tokenRefPresent,
        token_ref_scheme: tokenRefScheme,
        token_resolved: tokenResolved,
        configured: Boolean(config.baseUrl && tokenResolved),
      },
    });
  });

  // ─── PUT /ha/config ───
  app.put('/ha/config', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    const isPlatformAdmin = String((request as any).userRole || '').trim() === 'platform_admin';
    const body = request.body as { base_url?: string; token_ref?: string } | null;

    if (!body || (!body.base_url && !body.token_ref)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'base_url or token_ref is required' },
      });
      return;
    }

    const updates: Array<{ key: string; value: string }> = [];
    if (body.base_url) {
      const trimmed = body.base_url.trim();
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION', message: 'base_url must use http or https' },
          });
          return;
        }
      } catch {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'base_url must be a valid URL' },
        });
        return;
      }
      if (trimmed.length > 2048) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'base_url is too long' },
        });
        return;
      }
      updates.push({ key: 'ha.base_url', value: trimmed });
    }
    if (body.token_ref) {
      const tokenRef = body.token_ref.trim();
      if (!isValidSecretRef(tokenRef)) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'token_ref must use env://, vault://, or sops:// scheme with safe path characters',
          },
        });
        return;
      }
      updates.push({ key: 'ha.token_ref', value: tokenRef });
    }

    const writeScope: 'org' | 'global' | null = orgId ? 'org' : (isPlatformAdmin ? 'global' : null);
    if (!writeScope) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }

    for (const update of updates) {
      if (writeScope === 'org') {
        await pool.query(
          `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
           VALUES ($1, $2, $3::jsonb, NOW(), $4)
           ON CONFLICT (organization_id, key) DO UPDATE
           SET value = $3::jsonb, updated_at = NOW(), updated_by = $4`,
          [orgId, update.key, JSON.stringify(update.value), (request as any).userId],
        );
      } else {
        await pool.query(
          `INSERT INTO settings_global (key, value, updated_at, updated_by)
           VALUES ($1, $2::jsonb, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW(), updated_by = $3`,
          [update.key, JSON.stringify(update.value), (request as any).userId],
        );
      }
    }

    reply.send({ success: true });
  });

  // ─── GET /ha/discovery/entities ───
  app.get('/ha/discovery/entities', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    const config = await resolveHaConfig(pool, orgId);
    const token = await resolveHaBearerToken(config.tokenRef);
    if (!config.baseUrl || !token) {
      reply.status(400).send({
        success: false,
        error: { code: 'MISSING_CONFIG', message: 'HA config is incomplete (ha.base_url + ha.token_ref required)' },
      });
      return;
    }

    const query = request.query as { domain?: string; limit?: string };
    const domainFilter = String(query.domain || '').trim().toLowerCase();
    const limitNum = Number(query.limit || 100);
    const limit = Number.isFinite(limitNum) ? Math.min(500, Math.max(1, Math.floor(limitNum))) : 100;

    try {
      const res = await fetch(`${config.baseUrl}/api/states`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        reply.status(502).send({
          success: false,
          error: { code: 'HA_REQUEST_FAILED', message: `HA request failed (${res.status})` },
        });
        return;
      }
      const states = (await res.json()) as Array<Record<string, unknown>>;
      const rows = states
        .map((state) => {
          const entityId = String(state.entity_id || '').trim();
          const domain = entityId.split('.')[0] || '';
          const attrs = state.attributes && typeof state.attributes === 'object'
            ? (state.attributes as Record<string, unknown>)
            : {};
          return {
            entity_id: entityId,
            domain,
            state: String(state.state || ''),
            friendly_name: String(attrs.friendly_name || entityId),
            danger_tier: defaultHaDangerTier(entityId),
            allowlist_pattern: entityId,
          };
        })
        .filter((row) => row.entity_id.length > 0)
        .filter((row) => (domainFilter ? row.domain === domainFilter : true))
        .sort((a, b) => b.danger_tier - a.danger_tier || a.entity_id.localeCompare(b.entity_id))
        .slice(0, limit);

      reply.send({
        success: true,
        data: {
          rows,
          total: rows.length,
          domain_filter: domainFilter || null,
          limit,
        },
      });
    } catch (err) {
      request.log.error({ err }, 'HA discovery failed');
      reply.status(502).send({
        success: false,
        error: { code: 'HA_DISCOVERY_FAILED', message: 'Failed to discover Home Assistant entities' },
      });
    }
  });
}
