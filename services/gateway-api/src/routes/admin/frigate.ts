import { FastifyInstance } from 'fastify';
import pg from 'pg';

type FrigateConfig = {
  baseUrl?: string;
  token?: string;
  tokenRef?: string;
  error?: string;
};

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

async function resolveSecretRef(ref: string): Promise<string> {
  if (ref.startsWith('env://')) {
    const key = ref.slice('env://'.length);
    if (!key) throw new Error('Invalid env ref');
    const value = process.env[key];
    if (value === undefined) throw new Error(`Env var not set: ${key}`);
    return value;
  }
  throw new Error('Unsupported secret ref (use env://...)');
}

async function getFrigateConfig(pool: pg.Pool, orgId: string): Promise<FrigateConfig> {
  const settingsRes = await pool.query(
    `SELECT key, value
     FROM organization_settings
     WHERE organization_id = $1
       AND key IN ('frigate.base_url', 'frigate.token_ref')`,
    [orgId],
  );
  const settings = new Map(settingsRes.rows.map((row) => [row.key, row.value]));
  const baseUrlSetting = parseSettingValue<string>(settings.get('frigate.base_url'))?.trim();
  const tokenRef = parseSettingValue<string>(settings.get('frigate.token_ref'))?.trim();
  const baseUrl = baseUrlSetting || process.env.FRIGATE_BASE_URL?.trim();

  let token: string | undefined;
  if (tokenRef) {
    try {
      token = await resolveSecretRef(tokenRef);
    } catch (err) {
      return { baseUrl, tokenRef, error: String(err) };
    }
  } else {
    token = process.env.FRIGATE_TOKEN?.trim();
  }

  if (!baseUrl) return { tokenRef, error: 'Frigate base URL is not configured' };
  if (!token) return { baseUrl, tokenRef, error: 'Frigate token is not configured' };
  return { baseUrl: baseUrl.replace(/\/+$/, ''), tokenRef, token };
}

async function frigateRequest(config: FrigateConfig, method: string, path: string, body?: unknown) {
  if (!config.baseUrl || !config.token) {
    throw new Error(config.error || 'Frigate config unavailable');
  }
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  return { ok: res.ok, status: res.status, payload };
}

export async function registerFrigateRoutes(app: FastifyInstance, pool: pg.Pool) {
  function requireGlobalAdmin(request: any, reply: any): boolean {
    if (String(request.userRole || '').trim() === 'platform_admin') return true;
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
    return false;
  }

  app.addHook('preHandler', async (request: any, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (request.orgId) return;
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return;
  });

  app.get('/frigate/config', async (request, reply) => {
    const orgId = String((request as any).orgId || '').trim();
    const settingsRes = await pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1
         AND key IN ('frigate.base_url', 'frigate.token_ref')`,
      [orgId],
    );
    const settings = new Map(settingsRes.rows.map((row) => [row.key, row.value]));
    const baseUrlPersisted = parseSettingValue<string>(settings.get('frigate.base_url'))?.trim() || '';
    const tokenRefPersisted = parseSettingValue<string>(settings.get('frigate.token_ref'))?.trim() || '';
    const configuredPersisted = Boolean(baseUrlPersisted && tokenRefPersisted);
    const effectiveConfig = await getFrigateConfig(pool, orgId);
    const configuredEffective = Boolean(effectiveConfig.baseUrl && effectiveConfig.token);
    const baseUrlSource = baseUrlPersisted ? 'settings' : (process.env.FRIGATE_BASE_URL?.trim() ? 'env' : null);
    const tokenSource = tokenRefPersisted ? 'token_ref' : (process.env.FRIGATE_TOKEN?.trim() ? 'env' : null);

    reply.send({
      success: true,
      data: {
        base_url: baseUrlPersisted || null,
        token_ref: tokenRefPersisted || null,
        configured: configuredEffective,
        configured_effective: configuredEffective,
        configured_persisted: configuredPersisted,
        base_url_source: baseUrlSource,
        token_source: tokenSource,
      },
    });
  });

  app.put('/frigate/config', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    const body = request.body as { base_url?: string; token_ref?: string } | null;
    if (!body || (!body.base_url && !body.token_ref)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'base_url or token_ref is required' },
      });
      return;
    }

    const updates: Array<{ key: string; value: string }> = [];
    if (body.base_url) updates.push({ key: 'frigate.base_url', value: body.base_url.trim() });
    if (body.token_ref) updates.push({ key: 'frigate.token_ref', value: body.token_ref.trim() });

    for (const update of updates) {
      await pool.query(
        `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, NOW(), $4)
         ON CONFLICT (organization_id, key)
         DO UPDATE SET value = $3::jsonb, updated_at = NOW(), updated_by = $4`,
        [orgId, update.key, JSON.stringify(update.value), (request as any).userId],
      );
    }

    reply.send({ success: true });
  });

  app.get('/frigate/health', async (request, reply) => {
    const orgId = String((request as any).orgId || '').trim();
    const config = await getFrigateConfig(pool, orgId);
    if (config.error) {
      reply.status(400).send({ success: false, error: { code: 'CONFIG', message: config.error } });
      return;
    }

    const result = await frigateRequest(config, 'GET', '/api/version');
    if (!result.ok) {
      reply.status(502).send({
        success: false,
        error: { code: 'UPSTREAM', message: `Frigate request failed (${result.status})` },
      });
      return;
    }
    reply.send({ success: true, data: result.payload });
  });

  app.get('/frigate/cameras', async (request, reply) => {
    const orgId = String((request as any).orgId || '').trim();
    const config = await getFrigateConfig(pool, orgId);
    if (config.error) {
      reply.status(400).send({ success: false, error: { code: 'CONFIG', message: config.error } });
      return;
    }

    const result = await frigateRequest(config, 'GET', '/api/config');
    if (!result.ok) {
      reply.status(502).send({
        success: false,
        error: { code: 'UPSTREAM', message: `Frigate request failed (${result.status})` },
      });
      return;
    }

    const payload = result.payload as Record<string, unknown>;
    const cameras = payload && typeof payload === 'object' ? (payload.cameras || {}) : {};
    reply.send({ success: true, data: { cameras } });
  });

  app.get('/frigate/events', async (request, reply) => {
    const query = request.query as {
      camera?: string;
      label?: string;
      zone?: string;
      limit?: string;
      has_clip?: string;
      has_snapshot?: string;
    };
    const orgId = String((request as any).orgId || '').trim();
    const config = await getFrigateConfig(pool, orgId);
    if (config.error) {
      reply.status(400).send({ success: false, error: { code: 'CONFIG', message: config.error } });
      return;
    }

    const params = new URLSearchParams();
    if (query.camera) params.set('camera', query.camera);
    if (query.label) params.set('label', query.label);
    if (query.zone) params.set('zone', query.zone);
    if (query.limit) params.set('limit', query.limit);
    if (query.has_clip) params.set('has_clip', query.has_clip);
    if (query.has_snapshot) params.set('has_snapshot', query.has_snapshot);

    const path = `/api/events${params.size ? `?${params.toString()}` : ''}`;
    const result = await frigateRequest(config, 'GET', path);
    if (!result.ok) {
      reply.status(502).send({
        success: false,
        error: { code: 'UPSTREAM', message: `Frigate request failed (${result.status})` },
      });
      return;
    }
    reply.send({ success: true, data: result.payload });
  });

  app.get('/frigate/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgId = String((request as any).orgId || '').trim();
    const config = await getFrigateConfig(pool, orgId);
    if (config.error) {
      reply.status(400).send({ success: false, error: { code: 'CONFIG', message: config.error } });
      return;
    }

    const result = await frigateRequest(config, 'GET', `/api/events/${encodeURIComponent(id)}`);
    if (!result.ok) {
      reply.status(502).send({
        success: false,
        error: { code: 'UPSTREAM', message: `Frigate request failed (${result.status})` },
      });
      return;
    }
    reply.send({ success: true, data: result.payload });
  });

  app.post('/frigate/proxy', async (request, reply) => {
    const body = request.body as {
      method?: string;
      path?: string;
      query?: Record<string, string | number | boolean>;
      body?: unknown;
    } | null;
    const method = String(body?.method || 'GET').toUpperCase();
    const reqPath = String(body?.path || '');

    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'method must be GET/POST/PUT/PATCH/DELETE' },
      });
      return;
    }
    if (!reqPath.startsWith('/api/')) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'path must start with /api/' },
      });
      return;
    }

    const orgId = String((request as any).orgId || '').trim();
    const config = await getFrigateConfig(pool, orgId);
    if (config.error) {
      reply.status(400).send({ success: false, error: { code: 'CONFIG', message: config.error } });
      return;
    }

    const params = new URLSearchParams();
    if (body?.query && typeof body.query === 'object') {
      for (const [k, v] of Object.entries(body.query)) {
        params.set(k, String(v));
      }
    }
    const path = params.size ? `${reqPath}?${params.toString()}` : reqPath;
    const result = await frigateRequest(config, method, path, body?.body);

    reply.status(result.ok ? 200 : 502).send({
      success: result.ok,
      data: result.ok ? result.payload : undefined,
      error: result.ok
        ? undefined
        : { code: 'UPSTREAM', message: `Frigate request failed (${result.status})` },
    });
  });
}
