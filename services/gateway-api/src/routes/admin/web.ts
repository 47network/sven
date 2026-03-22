/**
 * Web Fetch Admin Routes
 * Manage web allowlists and test connections
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../db.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';

interface AddAllowlistRequest {
  pattern: string;
  description?: string;
}

interface TestFetchRequest {
  url: string;
  timeout?: number;
  max_content_length?: number;
}

const TEST_FETCH_TIMEOUT_DEFAULT_MS = 30000;
const TEST_FETCH_TIMEOUT_MIN_MS = 500;
const TEST_FETCH_TIMEOUT_MAX_MS = 120000;
const TEST_FETCH_MAX_CONTENT_DEFAULT_BYTES = 10 * 1024 * 1024;
const TEST_FETCH_MAX_CONTENT_MIN_BYTES = 1024;
const TEST_FETCH_MAX_CONTENT_MAX_BYTES = 20 * 1024 * 1024;

interface WidgetSettingsBody {
  enabled?: boolean;
  endpoint_url?: string;
  title?: string;
  avatar_url?: string | null;
  position?: 'bottom-right' | 'bottom-left';
  primary_color?: string;
  background_color?: string;
  welcome_text?: string;
}

const COLOR_HEX_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const UNSAFE_HTML_ATTR_TEXT_PATTERN = /[<>"']/;

function parseOptionalBoolean(raw: unknown): { valid: boolean; value: boolean | undefined } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: raw };
}

function normalizeWebBody<T extends object>(
  body: unknown,
): { ok: true; value: Partial<T> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as Partial<T> };
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function validateWidgetTextField(name: string, value: string): string | null {
  if (UNSAFE_HTML_ATTR_TEXT_PATTERN.test(value)) {
    return `${name} contains unsupported characters`;
  }
  return null;
}

function normalizeWidgetUrl(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export async function registerWebRoutes(fastify: FastifyInstance, db: Database) {
  /**
   * Get web domain allowlist
   */
  fastify.get('/web/allowlist', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!orgId) {
      return reply.status(403).send({ error: 'Active account required' });
    }

    try {
      const result = await db.query(
        `SELECT id, pattern, description, enabled, created_at FROM allowlists
         WHERE organization_id = $1 AND type = 'web_domain' ORDER BY created_at DESC`,
        [orgId],
      );

      return reply.send({ entries: result.rows });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch allowlist' });
    }
  });

  /**
   * Add domain to web allowlist
   */
  fastify.post<{ Body: AddAllowlistRequest }>('/web/allowlist', async (request: FastifyRequest<{ Body: AddAllowlistRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!orgId) {
      return reply.status(403).send({ error: 'Active account required' });
    }

    const body = normalizeWebBody<AddAllowlistRequest>(request.body);
    if (!body.ok) {
      return reply.status(400).send({ error: body.message });
    }
    const { pattern, description } = body.value;

    if (!pattern) {
      return reply.status(400).send({ error: 'pattern is required' });
    }

    try {
      const result = await db.query(
        `INSERT INTO allowlists (organization_id, type, pattern, description, enabled)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, pattern, description, enabled, created_at`,
        [orgId, 'web_domain', pattern, description || null]
      );

      return reply.status(201).send(result.rows[0]);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to add allowlist entry' });
    }
  });

  /**
   * Toggle allowlist entry
   */
  fastify.patch<{ Params: { id: string }; Body: { enabled: boolean } }>('/web/allowlist/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { enabled: boolean } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!orgId) {
      return reply.status(403).send({ error: 'Active account required' });
    }

    const { id } = request.params;
    const body = normalizeWebBody<{ enabled?: unknown }>(request.body);
    if (!body.ok) {
      return reply.status(400).send({ error: body.message });
    }
    const { enabled } = body.value;
    if (typeof enabled !== 'boolean') {
      return reply.status(400).send({ error: 'enabled must be a boolean when provided' });
    }

    try {
      const result = await db.query(
        `UPDATE allowlists SET enabled = $1 WHERE id = $2 AND organization_id = $3 AND type = $4 RETURNING *`,
        [enabled, id, orgId, 'web_domain']
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Allowlist entry not found' });
      }

      return reply.send(result.rows[0]);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to update allowlist entry' });
    }
  });

  /**
   * Delete allowlist entry
   */
  fastify.delete<{ Params: { id: string } }>('/web/allowlist/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!orgId) {
      return reply.status(403).send({ error: 'Active account required' });
    }

    const { id } = request.params;

    try {
      const result = await db.query(
        'DELETE FROM allowlists WHERE id = $1 AND organization_id = $2 AND type = $3 RETURNING id',
        [id, orgId, 'web_domain'],
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Allowlist entry not found' });
      }

      return reply.send({ success: true, message: 'Allowlist entry deleted' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete allowlist entry' });
    }
  });

  /**
   * Test web fetch with current allowlist
   */
  fastify.post<{ Body: TestFetchRequest }>('/web/test-fetch', async (request: FastifyRequest<{ Body: TestFetchRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!orgId) {
      return reply.status(403).send({ error: 'Active account required' });
    }

    const body = normalizeWebBody<TestFetchRequest>(request.body);
    if (!body.ok) {
      return reply.status(400).send({ error: body.message });
    }
    const { url, timeout, max_content_length } = body.value;

    if (!url) {
      return reply.status(400).send({ error: 'url is required' });
    }

    try {
      // Get current allowlist
      const allowlistResult = await db.query(
        `SELECT pattern FROM allowlists WHERE organization_id = $1 AND type = 'web_domain' AND enabled = true`,
        [orgId],
      );

      const allowlist = allowlistResult.rows.map((row: any) => row.pattern);

      // Fetch web content
      const { fetchWebContent, validateDomainAllowlist } = await import('@sven/shared/integrations/web.js');

      // First validate
      const validation = validateDomainAllowlist(url, allowlist);
      if (!validation.valid) {
        return reply.status(403).send({ error: validation.reason || 'URL not in allowlist' });
      }

      const timeoutMs = Number.isFinite(Number(timeout))
        ? Math.min(TEST_FETCH_TIMEOUT_MAX_MS, Math.max(TEST_FETCH_TIMEOUT_MIN_MS, Math.trunc(Number(timeout))))
        : TEST_FETCH_TIMEOUT_DEFAULT_MS;
      const maxContentLength = Number.isFinite(Number(max_content_length))
        ? Math.min(
            TEST_FETCH_MAX_CONTENT_MAX_BYTES,
            Math.max(TEST_FETCH_MAX_CONTENT_MIN_BYTES, Math.trunc(Number(max_content_length))),
          )
        : TEST_FETCH_MAX_CONTENT_DEFAULT_BYTES;

      const result = await fetchWebContent(url, {
        allowlist,
        timeout: timeoutMs,
        maxContentLength,
        cacheTtlSeconds: 0, // No caching for test
      });

      return reply.send(result);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: `Fetch failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  /**
   * Get web cache stats
   */
  fastify.get('/web/cache-stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const summaryResult = await db.query(
        `SELECT
           COALESCE(SUM(current_size_bytes), 0)::bigint AS cache_size_bytes,
           COALESCE(SUM(current_entries), 0)::bigint AS cached_urls,
           COALESCE(SUM(cache_hits), 0)::bigint AS cache_hits,
           COALESCE(SUM(cache_misses), 0)::bigint AS cache_misses,
           COALESCE(SUM(total_requests), 0)::bigint AS total_requests
         FROM cache_stats`,
      );
      const row = summaryResult.rows[0] || {};
      const cacheSizeBytes = Number(row.cache_size_bytes || 0);
      const cachedUrls = Number(row.cached_urls || 0);
      const cacheHits = Number(row.cache_hits || 0);
      const cacheMisses = Number(row.cache_misses || 0);
      const totalRequests = Number(row.total_requests || 0);
      const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

      const perToolResult = await db.query(
        `SELECT
           tool_name,
           COALESCE(current_entries, 0)::bigint AS current_entries,
           COALESCE(current_size_bytes, 0)::bigint AS current_size_bytes,
           COALESCE(cache_hits, 0)::bigint AS cache_hits,
           COALESCE(cache_misses, 0)::bigint AS cache_misses,
           COALESCE(total_requests, 0)::bigint AS total_requests,
           sampled_at
         FROM cache_stats
         ORDER BY tool_name ASC`,
      );

      return reply.send({
        cacheSize: cacheSizeBytes,
        cacheSizeBytes,
        cachedUrls,
        hitRate,
        cacheHits,
        cacheMisses,
        totalRequests,
        tools: perToolResult.rows.map((entry: any) => {
          const toolRequests = Number(entry.total_requests || 0);
          const toolHits = Number(entry.cache_hits || 0);
          return {
            toolName: String(entry.tool_name || ''),
            currentEntries: Number(entry.current_entries || 0),
            currentSizeBytes: Number(entry.current_size_bytes || 0),
            cacheHits: toolHits,
            cacheMisses: Number(entry.cache_misses || 0),
            totalRequests: toolRequests,
            hitRate: toolRequests > 0 ? toolHits / toolRequests : 0,
            sampledAt: entry.sampled_at || null,
          };
        }),
        message: 'Web cache statistics',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to get cache stats' });
    }
  });

  /**
   * GET /web/widget/settings
   * Fetch embeddable widget configuration for active organization.
   */
  fastify.get('/web/widget/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    if (!orgId) return reply.status(403).send({ error: 'Active account required' });

    try {
      const res = await db.query(
        `SELECT organization_id, enabled, endpoint_url, title, avatar_url, position,
                primary_color, background_color, welcome_text, updated_at
         FROM web_widget_settings
         WHERE organization_id = $1
         LIMIT 1`,
        [orgId],
      );
      if (!res.rows.length) {
        return reply.send({
          organization_id: orgId,
          enabled: true,
          endpoint_url: process.env.WEBCHAT_WIDGET_ENDPOINT || '',
          title: 'Sven',
          avatar_url: null,
          position: 'bottom-right',
          primary_color: '#2563eb',
          background_color: '#0f172a',
          welcome_text: 'Hi, how can I help?',
        });
      }
      return reply.send(res.rows[0]);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch widget settings' });
    }
  });

  /**
   * PUT /web/widget/settings
   * Upsert embeddable widget configuration for active organization.
   */
  fastify.put<{ Body: WidgetSettingsBody }>('/web/widget/settings', async (request: FastifyRequest<{ Body: WidgetSettingsBody }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    if (!orgId) return reply.status(403).send({ error: 'Active account required' });

    const bodyParsed = normalizeWebBody<WidgetSettingsBody>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({ error: bodyParsed.message });
    }
    const body = bodyParsed.value;
    const endpointUrl = normalizeWidgetUrl(String(body.endpoint_url || process.env.WEBCHAT_WIDGET_ENDPOINT || ''));
    if (!endpointUrl) {
      return reply.status(400).send({ error: 'endpoint_url must be a valid http/https URL' });
    }
    const title = String(body.title || 'Sven').trim().slice(0, 100) || 'Sven';
    const titleValidation = validateWidgetTextField('title', title);
    if (titleValidation) {
      return reply.status(400).send({ error: titleValidation });
    }
    const avatarRaw = body.avatar_url == null ? '' : String(body.avatar_url).trim().slice(0, 500);
    const avatarUrl = avatarRaw ? normalizeWidgetUrl(avatarRaw) : null;
    if (avatarRaw && !avatarUrl) {
      return reply.status(400).send({ error: 'avatar_url must be a valid http/https URL when provided' });
    }
    const position = body.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
    const primaryColor = String(body.primary_color || '#2563eb').trim().slice(0, 32) || '#2563eb';
    const backgroundColor = String(body.background_color || '#0f172a').trim().slice(0, 32) || '#0f172a';
    if (!COLOR_HEX_PATTERN.test(primaryColor)) {
      return reply.status(400).send({ error: 'primary_color must be a valid 3/6-digit hex color' });
    }
    if (!COLOR_HEX_PATTERN.test(backgroundColor)) {
      return reply.status(400).send({ error: 'background_color must be a valid 3/6-digit hex color' });
    }
    const welcomeText = String(body.welcome_text || 'Hi, how can I help?').trim().slice(0, 400) || 'Hi, how can I help?';
    const welcomeValidation = validateWidgetTextField('welcome_text', welcomeText);
    if (welcomeValidation) {
      return reply.status(400).send({ error: welcomeValidation });
    }
    const enabledParsed = parseOptionalBoolean((body as { enabled?: unknown }).enabled);
    if (!enabledParsed.valid) {
      return reply.status(400).send({ error: 'enabled must be a boolean when provided' });
    }
    const enabled = enabledParsed.value ?? true;

    try {
      const result = await db.query(
        `INSERT INTO web_widget_settings
           (organization_id, enabled, endpoint_url, title, avatar_url, position,
            primary_color, background_color, welcome_text, updated_by, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (organization_id)
         DO UPDATE SET
           enabled = EXCLUDED.enabled,
           endpoint_url = EXCLUDED.endpoint_url,
           title = EXCLUDED.title,
           avatar_url = EXCLUDED.avatar_url,
           position = EXCLUDED.position,
           primary_color = EXCLUDED.primary_color,
           background_color = EXCLUDED.background_color,
           welcome_text = EXCLUDED.welcome_text,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING organization_id, enabled, endpoint_url, title, avatar_url, position,
                   primary_color, background_color, welcome_text, updated_at`,
        [orgId, enabled, endpointUrl, title, avatarUrl, position, primaryColor, backgroundColor, welcomeText, userId],
      );
      return reply.send(result.rows[0]);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to save widget settings' });
    }
  });

  /**
   * GET /web/widget/instances
   * List widget API-key instances (keys are never returned).
   */
  fastify.get('/web/widget/instances', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    if (!orgId) return reply.status(403).send({ error: 'Active account required' });

    try {
      const result = await db.query(
        `SELECT id, name, api_key_last4, rate_limit_rpm, enabled, created_at, updated_at
         FROM web_widget_instances
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [orgId],
      );
      return reply.send({ instances: result.rows });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch widget instances' });
    }
  });

  /**
   * POST /web/widget/instances
   * Create a widget instance and return one-time API key.
   */
  fastify.post<{ Body: { name?: string; rate_limit_rpm?: number } }>('/web/widget/instances', async (request: FastifyRequest<{ Body: { name?: string; rate_limit_rpm?: number } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    if (!orgId) return reply.status(403).send({ error: 'Active account required' });

    const name = String(request.body?.name || 'Widget Instance').trim().slice(0, 120) || 'Widget Instance';
    const rpmRaw = Number(request.body?.rate_limit_rpm || 60);
    const rateLimitRpm = Number.isFinite(rpmRaw) ? Math.min(2000, Math.max(1, Math.trunc(rpmRaw))) : 60;
    const key = `sven_wgt_${randomBytes(24).toString('base64url')}`;
    const keyHash = await bcrypt.hash(key, 12);
    const keyLast4 = key.slice(-4);
    const id = randomBytes(12).toString('hex');

    try {
      await db.query(
        `INSERT INTO web_widget_instances
           (id, organization_id, name, api_key_hash, api_key_last4, rate_limit_rpm, enabled, created_by, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, TRUE, $7, NOW(), NOW())`,
        [id, orgId, name, keyHash, keyLast4, rateLimitRpm, userId],
      );
      return reply.status(201).send({
        id,
        name,
        rate_limit_rpm: rateLimitRpm,
        api_key: key,
        api_key_last4: keyLast4,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to create widget instance' });
    }
  });

  /**
   * GET /web/widget/embed/:instanceId
   * Generate embeddable script snippet for a widget instance.
   */
  fastify.get<{ Params: { instanceId: string } }>('/web/widget/embed/:instanceId', async (request: FastifyRequest<{ Params: { instanceId: string } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = (request as any).orgId as string;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    if (!orgId) return reply.status(403).send({ error: 'Active account required' });

    const instanceId = String(request.params.instanceId || '').trim();
    if (!instanceId) return reply.status(400).send({ error: 'instanceId is required' });

    try {
      const widget = await db.query(
        `SELECT id, name, api_key_last4, rate_limit_rpm
         FROM web_widget_instances
         WHERE id = $1 AND organization_id = $2 AND enabled = TRUE
         LIMIT 1`,
        [instanceId, orgId],
      );
      if (!widget.rows.length) {
        return reply.status(404).send({ error: 'Widget instance not found' });
      }

      const settings = await db.query(
        `SELECT endpoint_url, title, avatar_url, position, primary_color, background_color, welcome_text
         FROM web_widget_settings
         WHERE organization_id = $1
         LIMIT 1`,
        [orgId],
      );
      const s = settings.rows[0] || {};
      const endpoint = normalizeWidgetUrl(String(s.endpoint_url || process.env.WEBCHAT_WIDGET_ENDPOINT || ''));
      if (!endpoint) {
        return reply.status(400).send({ error: 'Widget endpoint_url is not configured' });
      }

      const endpointEscaped = escapeHtmlAttribute(endpoint);
      const titleEscaped = escapeHtmlAttribute(String(s.title || 'Sven'));
      const positionEscaped = escapeHtmlAttribute(String(s.position || 'bottom-right'));
      const primaryEscaped = escapeHtmlAttribute(String(s.primary_color || '#2563eb'));
      const backgroundEscaped = escapeHtmlAttribute(String(s.background_color || '#0f172a'));
      const avatarEscaped = escapeHtmlAttribute(String(s.avatar_url || ''));
      const welcomeEscaped = escapeHtmlAttribute(String(s.welcome_text || 'Hi, how can I help?'));

      const snippet = `<script src="${endpointEscaped}/widget.js" data-endpoint="${endpointEscaped}" data-api-key="REPLACE_WITH_WIDGET_API_KEY" data-title="${titleEscaped}" data-position="${positionEscaped}" data-primary-color="${primaryEscaped}" data-background-color="${backgroundEscaped}" data-avatar-url="${avatarEscaped}" data-welcome-text="${welcomeEscaped}"></script>`;

      return reply.send({
        instance: widget.rows[0],
        endpoint,
        embed_snippet: snippet,
        note: 'Replace REPLACE_WITH_WIDGET_API_KEY with the one-time key value shown at instance creation.',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to generate embed snippet' });
    }
  });
}
