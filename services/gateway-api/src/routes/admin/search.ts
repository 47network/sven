import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { isSafeSearchQuery, normalizeSearchQuery } from '../../lib/input-validation.js';
import { validateUpdateFeedUrl } from '../../services/UpdateCheckerService.js';

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

const SEARCH_SETTING_KEYS = [
  'search.searxng_url',
  'search.safeSearch',
  'search.engines',
  'search.default_language',
  'search.max_results',
] as const;

type SafeSearchLevel = 'off' | 'moderate' | 'strict';

function sanitizeSearchResultUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    const trackingKeys = new Set([
      'gclid',
      'fbclid',
      'msclkid',
      'mc_cid',
      'mc_eid',
      'ref',
      'ref_src',
    ]);
    const keys = Array.from(parsed.searchParams.keys());
    for (const key of keys) {
      if (key.startsWith('utm_') || trackingKeys.has(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function isLikelyAdResult(url: string, title: string, snippet: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  if (lowerTitle.includes('sponsored') || lowerSnippet.includes('sponsored')) return true;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'doubleclick.net' || host.endsWith('.doubleclick.net') ||
      host === 'googlesyndication.com' || host.endsWith('.googlesyndication.com') ||
      host === 'adservice.google.com' || host.startsWith('adservice.')
    ) return true;
    if (parsed.pathname.toLowerCase().includes('/aclk')) return true;
  } catch {
    // Ignore malformed URLs and let caller decide.
  }
  return false;
}

function sanitizeSearchErrorMessage(message: string, query: string): string {
  if (!message) return message;
  let next = message;
  const encoded = encodeURIComponent(query);
  if (query) {
    next = next.split(query).join('[REDACTED_QUERY]');
  }
  if (encoded && encoded !== query) {
    next = next.split(encoded).join('[REDACTED_QUERY]');
  }
  next = next.replace(/([?&]q=)([^&\s]+)/gi, '$1[REDACTED_QUERY]');
  return next;
}

function parseNumResults(raw: unknown): { valid: boolean; value?: number } {
  if (raw === undefined) {
    return { valid: true, value: 10 };
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw)) {
    return { valid: false };
  }
  return { valid: true, value: Math.min(Math.max(raw, 1), 50) };
}

export async function registerSearchRoutes(app: FastifyInstance, pool: pg.Pool) {
  const LEGACY_SEARXNG_DEFAULTS = new Set(['http://searxng:8080', 'http://searxng:8080/']);
  const searchHostAllowlist = String(process.env.SEARCH_SEARXNG_HOST_ALLOWLIST || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  function normalizeUrlCandidate(raw: unknown): string {
    const candidate = String(raw || '').trim();
    if (!candidate) return '';
    try {
      return new URL(candidate).toString();
    } catch {
      return candidate;
    }
  }

  function isLegacySearxngPlaceholder(raw: unknown): boolean {
    return LEGACY_SEARXNG_DEFAULTS.has(normalizeUrlCandidate(raw));
  }

  function parseAndValidateSearxngUrl(raw: unknown): { ok: true; url: string } | { ok: false; message: string } {
    const candidate = String(raw || '').trim();
    if (!candidate) {
      return { ok: true, url: '' };
    }
    const validated = validateUpdateFeedUrl(candidate, searchHostAllowlist);
    if (!validated.ok) {
      return {
        ok: false,
        message: 'searxng_url is not allowed (must be public HTTP(S) and satisfy configured host allowlist)',
      };
    }
    return { ok: true, url: validated.url.toString() };
  }

  function resolveEffectiveSearxngCandidate(raw: unknown): string {
    const configured = String(raw || '').trim();
    const envCandidate = String(process.env.SEARXNG_URL || '').trim();
    if (!configured) {
      return envCandidate || 'http://searxng:8080';
    }
    if (isLegacySearxngPlaceholder(configured) && envCandidate) {
      const normalizedConfigured = normalizeUrlCandidate(configured);
      const normalizedEnv = normalizeUrlCandidate(envCandidate);
      if (normalizedEnv && normalizedEnv !== normalizedConfigured) {
        return envCandidate;
      }
    }
    return configured;
  }

  function resolveValidatedSearxngUrl(raw: unknown): { ok: true; url: string } | { ok: false } {
    const effective = resolveEffectiveSearxngCandidate(raw);
    const finalValidation = parseAndValidateSearxngUrl(effective);
    if (!finalValidation.ok || !finalValidation.url) return { ok: false };
    return { ok: true, url: finalValidation.url };
  }

  function requireGlobalAdmin(request: any, reply: any): boolean {
    if (String(request.userRole || '').trim() === 'platform_admin') return true;
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
    return false;
  }

  // ─── GET /search/config ───
  app.get('/search/config', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    const result = await pool.query(
      `SELECT key, value FROM settings_global WHERE key = ANY($1) ORDER BY key`,
      [SEARCH_SETTING_KEYS],
    );

    const settings = new Map(result.rows.map((row: { key: string; value: unknown }) => [row.key, row.value]));
    const resolvedSearxngUrl = resolveValidatedSearxngUrl(parseSettingValue<string>(settings.get('search.searxng_url')));

    reply.send({
      success: true,
      data: {
        searxng_url:
          (resolvedSearxngUrl.ok ? resolvedSearxngUrl.url : parseSettingValue<string>(settings.get('search.searxng_url'))) || null,
        safe_search: parseSettingValue<SafeSearchLevel>(settings.get('search.safeSearch')) || 'moderate',
        engines: parseSettingValue<string[]>(settings.get('search.engines')) || [],
        default_language: parseSettingValue<string>(settings.get('search.default_language')) || 'auto',
        max_results: parseSettingValue<number>(settings.get('search.max_results')) || 10,
      },
    });
  });

  // ─── PUT /search/config ───
  app.put('/search/config', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    const body = request.body as {
      searxng_url?: string;
      safe_search?: SafeSearchLevel;
      engines?: string[];
      default_language?: string;
      max_results?: number;
    } | null;

    if (!body) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Request body is required' },
      });
    }

    const updates: Array<{ key: string; value: unknown }> = [];

    if (body.searxng_url !== undefined) {
      const validatedUrl = parseAndValidateSearxngUrl(body.searxng_url);
      if (!validatedUrl.ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: validatedUrl.message },
        });
      }
      updates.push({ key: 'search.searxng_url', value: validatedUrl.url || null });
    }

    if (body.safe_search !== undefined) {
      const valid: SafeSearchLevel[] = ['off', 'moderate', 'strict'];
      if (!valid.includes(body.safe_search)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: `safe_search must be one of: ${valid.join(', ')}` },
        });
      }
      updates.push({ key: 'search.safeSearch', value: body.safe_search });
    }

    if (body.engines !== undefined) {
      if (!Array.isArray(body.engines) || body.engines.some((e) => typeof e !== 'string')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'engines must be an array of strings' },
        });
      }
      updates.push({ key: 'search.engines', value: body.engines });
    }

    if (body.default_language !== undefined) {
      updates.push({ key: 'search.default_language', value: body.default_language });
    }

    if (body.max_results !== undefined) {
      const n = Number(body.max_results);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'max_results must be an integer between 1 and 100' },
        });
      }
      updates.push({ key: 'search.max_results', value: n });
    }

    if (updates.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'No valid settings provided' },
      });
    }

    for (const { key, value } of updates) {
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), $3)
         ON CONFLICT (key) DO UPDATE
         SET value = $2::jsonb, updated_at = NOW(), updated_by = $3`,
        [key, JSON.stringify(value), (request as any).userId],
      );
    }

    reply.send({ success: true, data: { updated: updates.map((u) => u.key) } });
  });

  // ─── POST /search/test ── Verify SearXNG connectivity ───
  app.post('/search/test', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    const urlRes = await pool.query(
      `SELECT value FROM settings_global WHERE key = 'search.searxng_url'`,
    );
    const searxngUrl = resolveValidatedSearxngUrl(parseSettingValue<string>(urlRes.rows[0]?.value));
    if (!searxngUrl.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'SEARCH_UNSAFE_TARGET', message: 'Configured search upstream URL is not allowed' },
      });
    }

    try {
      const testUrl = new URL('/search', searxngUrl.url);
      testUrl.searchParams.set('q', 'test');
      testUrl.searchParams.set('format', 'json');
      testUrl.searchParams.set('categories', 'general');

      const response = await fetch(testUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return reply.status(502).send({
          success: false,
          error: {
            code: 'SEARCH_DIAGNOSTICS_UNREACHABLE',
            message: `SearXNG returned ${response.status} ${response.statusText}`,
          },
          data: {
            reachable: false,
            status: response.status,
          },
        });
      }

      const data = (await response.json()) as { results?: unknown[]; number_of_results?: number };

      reply.send({
        success: true,
        data: {
          reachable: true,
          status: response.status,
          result_count: data.results?.length || 0,
          total_results: data.number_of_results || 0,
        },
      });
    } catch (err) {
      app.log.error({ err }, 'Search diagnostics probe failed');
      const errorName = err instanceof Error ? err.name : '';
      const timeout = errorName === 'AbortError' || errorName === 'TimeoutError';
      reply.status(timeout ? 504 : 502).send({
        success: false,
        error: {
          code: timeout ? 'SEARCH_DIAGNOSTICS_TIMEOUT' : 'SEARCH_DIAGNOSTICS_FAILED',
          message: 'Search diagnostics probe failed',
        },
        data: {
          reachable: false,
        },
      });
    }
  });

  // ─── POST /search/query ── Run a test search against SearXNG ───
  app.post('/search/query', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    const body = request.body as {
      query?: string;
      num_results?: number;
      categories?: string;
      language?: string;
    } | null;

    const query = normalizeSearchQuery(body?.query);
    if (!query) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'query is required' },
      });
    }
    if (!isSafeSearchQuery(query)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'query contains unsafe content' },
      });
    }

    const numResultsParsed = parseNumResults(body?.num_results);
    if (!numResultsParsed.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'num_results must be an integer between 1 and 50' },
      });
    }
    const numResults = numResultsParsed.value as number;
    const allowedCategories = new Set(['general', 'images', 'news', 'files', 'science']);
    const categories = String(body?.categories || 'general')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => allowedCategories.has(c))
      .join(',') || 'general';
    const language = String(body?.language || 'auto').trim() || 'auto';

    const settingsRes = await pool.query(
      `SELECT key, value FROM settings_global WHERE key = ANY($1::text[])`,
      [['search.searxng_url', 'search.safeSearch', 'search.engines']],
    );
    const settings = new Map(settingsRes.rows.map((row: { key: string; value: unknown }) => [row.key, row.value]));

    const searxngUrl =
      resolveValidatedSearxngUrl(parseSettingValue<string>(settings.get('search.searxng_url')));
    if (!searxngUrl.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'SEARCH_UNSAFE_TARGET', message: 'Configured search upstream URL is not allowed' },
      });
    }
    const safeSearchSetting = parseSettingValue<SafeSearchLevel>(settings.get('search.safeSearch')) || 'moderate';
    const engines = parseSettingValue<string[]>(settings.get('search.engines')) || [];
    const safeSearch = safeSearchSetting === 'off' ? '0' : safeSearchSetting === 'strict' ? '2' : '1';

    try {
      const searchUrl = new URL('/search', searxngUrl.url);
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('format', 'json');
      searchUrl.searchParams.set('categories', categories);
      searchUrl.searchParams.set('language', language);
      searchUrl.searchParams.set('safesearch', safeSearch);
      searchUrl.searchParams.set('pageno', '1');
      if (Array.isArray(engines) && engines.length > 0) {
        searchUrl.searchParams.set('engines', engines.join(','));
      }

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return reply.status(502).send({
          success: false,
          error: { code: 'UPSTREAM_ERROR', message: `SearXNG returned ${response.status}` },
        });
      }

      const data = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string; engine?: string }>;
        number_of_results?: number;
      };
      const results = (data.results || [])
        .slice(0, numResults)
        .map((item) => ({
          title: String(item.title || ''),
          url: sanitizeSearchResultUrl(String(item.url || '')),
          snippet: String(item.content || ''),
          source_engine: String(item.engine || 'unknown'),
        }))
        .filter((item) => item.url && !isLikelyAdResult(item.url, item.title, item.snippet));

      reply.send({
        success: true,
        data: {
          query,
          total: Number(data.number_of_results || results.length),
          results,
        },
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      reply.status(502).send({
        success: false,
        error: { code: 'UPSTREAM_ERROR', message: sanitizeSearchErrorMessage(raw, query) },
      });
    }
  });

  // ─── GET /search/stats ── Search usage stats for admin UI ───
  app.get('/search/stats', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    const orgId = String((request as any).orgId || '').trim();
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
    const perDayRes = await pool.query(
      `SELECT date_trunc('day', tr.created_at) AS day, COUNT(*)::int AS count
       FROM tool_runs tr
       JOIN chats c ON c.id = tr.chat_id
       WHERE tr.tool_name = 'search.web'
         AND c.organization_id::text = $1::text
         AND tr.created_at >= NOW() - INTERVAL '14 days'
       GROUP BY 1
       ORDER BY 1 DESC`,
      [orgId],
    );

    const popularCategoriesRes = await pool.query(
      `SELECT COALESCE(NULLIF(inputs->>'categories', ''), 'general') AS category,
              COUNT(*)::int AS count
       FROM tool_runs tr
       JOIN chats c ON c.id = tr.chat_id
       WHERE tr.tool_name = 'search.web'
         AND c.organization_id::text = $1::text
         AND tr.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 10`,
      [orgId],
    );

    const queriesDayRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM tool_runs tr
       JOIN chats c ON c.id = tr.chat_id
       WHERE tr.tool_name = 'search.web'
         AND c.organization_id::text = $1::text
         AND tr.created_at >= NOW() - INTERVAL '24 hours'`,
      [orgId],
    );

    reply.send({
      success: true,
      data: {
        queries_per_day: Number(queriesDayRes.rows[0]?.count || 0),
        daily_counts: perDayRes.rows.map((row: { day: string; count: number }) => ({
          day: row.day,
          count: Number(row.count || 0),
        })),
        popular_categories: popularCategoriesRes.rows.map((row: { category: string; count: number }) => ({
          category: row.category,
          count: Number(row.count || 0),
        })),
      },
    });
  });
}
