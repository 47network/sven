import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'node:crypto';
import { requireRole } from './auth.js';
import { parsePaginationQuery } from './admin/pagination.js';
import { embedTextFromEnv } from '../services/embeddings.js';

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function sendRegistrySchemaUnavailable(reply: any, surface: string): void {
  reply.status(503).send({
    success: false,
    error: {
      code: 'FEATURE_UNAVAILABLE',
      message: `Registry ${surface} schema not available in this environment`,
    },
  });
}

function getPaginationOrReply(
  reply: any,
  query: { page?: string; per_page?: string },
  maxPerPage = 100,
) {
  const parsed = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage });
  if (!parsed.ok) {
    reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION', message: parsed.message },
    });
    return null;
  }
  return parsed;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSemanticQuery(raw: unknown): string {
  return String(raw || '').trim().slice(0, 512);
}

function buildRegistryMarketplaceSemanticText(row: Record<string, unknown>): string {
  const manifest = isObjectRecord(row.manifest) ? row.manifest : {};
  const keywords = Array.isArray(manifest.keywords)
    ? manifest.keywords.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const tags = Array.isArray(manifest.tags)
    ? manifest.tags.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const categories = Array.isArray(manifest.categories)
    ? manifest.categories.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  return [
    String(row.name || '').trim(),
    String(row.description || '').trim(),
    String(row.format || '').trim(),
    String(manifest.summary || '').trim(),
    String(manifest.use_cases || '').trim(),
    String(manifest.provider || '').trim(),
    ...keywords,
    ...tags,
    ...categories,
  ]
    .filter(Boolean)
    .join('\n');
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  if (leftNorm <= 0 || rightNorm <= 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

const REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME = 'registry.marketplace.embedding';

function generateRegistryMarketplaceEmbeddingCacheKey(entryId: string, text: string): string {
  const textHash = createHash('sha256').update(text).digest('hex');
  return `${entryId}:${textHash}`;
}

async function getCachedRegistryMarketplaceEmbedding(pool: pg.Pool, cacheKey: string): Promise<number[] | null> {
  try {
    const result = await pool.query(
      `SELECT cached_output
         FROM tool_cache
        WHERE tool_name = $1
          AND cache_key = $2
          AND expires_at > CURRENT_TIMESTAMP`,
      [REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME, cacheKey],
    );
    if (result.rows.length === 0) return null;
    const parsed = JSON.parse(String(result.rows[0].cached_output || 'null'));
    if (!Array.isArray(parsed) || parsed.some((value) => !Number.isFinite(Number(value)))) {
      return null;
    }
    return parsed.map((value) => Number(value));
  } catch {
    return null;
  }
}

async function getCachedRegistryMarketplaceEmbeddings(pool: pg.Pool, cacheKeys: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (cacheKeys.length === 0) return result;

  try {
    const queryRes = await pool.query(
      `SELECT cache_key, cached_output
         FROM tool_cache
        WHERE tool_name = $1
          AND cache_key = ANY($2)
          AND expires_at > CURRENT_TIMESTAMP`,
      [REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME, cacheKeys],
    );
    for (const row of queryRes.rows) {
      try {
        const parsed = JSON.parse(String(row.cached_output || 'null'));
        if (Array.isArray(parsed) && !parsed.some((value) => !Number.isFinite(Number(value)))) {
          result.set(row.cache_key, parsed.map((value) => Number(value)));
        }
      } catch {
      }
    }
  } catch {
  }
  return result;
}

async function cacheRegistryMarketplaceEmbedding(pool: pg.Pool, cacheKey: string, embedding: number[]): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO tool_cache (tool_name, cache_key, cached_output, expires_at, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP)
       ON CONFLICT (tool_name, cache_key) DO UPDATE
       SET cached_output = EXCLUDED.cached_output,
           expires_at = EXCLUDED.expires_at`,
      [REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME, cacheKey, JSON.stringify(embedding)],
    );
  } catch {
    // Cache miss/failure should not break registry browse.
  }
}

async function enrichRegistryMarketplaceRows(pool: pg.Pool, orgId: string, rows: any[]): Promise<any[]> {
  if (rows.length === 0) return rows;
  const names = [...new Set(rows.map((row) => String(row.name || '')))].filter(Boolean);
  if (names.length === 0) return rows;

  const enrichmentQuery = `
    SELECT
      entry.name,
      (
        SELECT COUNT(*)::int
        FROM skills_catalog c2
        WHERE c2.organization_id = $1 AND c2.name = entry.name
      ) AS version_count,
      (
        SELECT COUNT(*)::int
        FROM skills_installed si
        JOIN skills_catalog c2 ON c2.id = si.catalog_entry_id AND c2.organization_id = si.organization_id
        WHERE si.organization_id = $1 AND c2.name = entry.name
      ) AS install_count,
      (
        SELECT COUNT(DISTINCT tr.id)::int
        FROM tool_runs tr
        JOIN tools t ON t.name = tr.tool_name
        JOIN skills_installed si ON si.tool_id = t.id AND si.organization_id = $1
        JOIN skills_catalog c2 ON c2.id = si.catalog_entry_id AND c2.organization_id = si.organization_id
        WHERE c2.name = entry.name AND tr.created_at >= NOW() - INTERVAL '30 days'
      ) AS usage_30d,
      (
        SELECT COALESCE(
          ROUND((COUNT(*) FILTER (WHERE tr.status IN ('error', 'timeout', 'denied'))::numeric / NULLIF(COUNT(*), 0)), 4),
          0
        )
        FROM tool_runs tr
        JOIN tools t ON t.name = tr.tool_name
        JOIN skills_installed si ON si.tool_id = t.id AND si.organization_id = $1
        JOIN skills_catalog c2 ON c2.id = si.catalog_entry_id AND c2.organization_id = si.organization_id
        WHERE c2.name = entry.name AND tr.created_at >= NOW() - INTERVAL '30 days'
      ) AS error_rate_30d,
      (
        SELECT COUNT(sr.id)::int
        FROM skill_reviews sr
        JOIN skills_catalog c2 ON c2.id = sr.catalog_entry_id AND c2.organization_id = sr.organization_id
        WHERE sr.organization_id = $1 AND c2.name = entry.name
      ) AS review_count,
      (
        SELECT COALESCE(ROUND(AVG(sr.rating)::numeric, 2), 0)
        FROM skill_reviews sr
        JOIN skills_catalog c2 ON c2.id = sr.catalog_entry_id AND c2.organization_id = sr.organization_id
        WHERE sr.organization_id = $1 AND c2.name = entry.name
      ) AS average_rating,
      (
        EXISTS (
          SELECT 1
          FROM skills_installed si
          JOIN skills_catalog c2 ON c2.id = si.catalog_entry_id AND c2.organization_id = si.organization_id
          WHERE si.organization_id = $1 AND c2.name = entry.name AND si.trust_level = 'trusted'
        )
        AND EXISTS (
          SELECT 1
          FROM skill_signatures ss
          JOIN skills_installed si ON si.id = ss.skill_id AND si.organization_id = ss.organization_id
          JOIN skills_catalog c2 ON c2.id = si.catalog_entry_id AND c2.organization_id = si.organization_id
          WHERE ss.organization_id = $1 AND c2.name = entry.name AND ss.verified = TRUE
        )
        AND NOT EXISTS (
          SELECT 1
          FROM skill_quarantine_reports qr
          JOIN skills_installed si ON si.id = qr.skill_id AND si.organization_id = qr.organization_id
          JOIN skills_catalog c2 ON c2.id = si.catalog_entry_id AND c2.organization_id = si.organization_id
          WHERE qr.organization_id = $1 AND c2.name = entry.name AND qr.overall_risk IN ('high', 'critical')
        )
      ) AS _is_verified
    FROM (SELECT UNNEST($2::text[]) AS name) entry
  `;

  try {
    const enrichmentResult = await pool.query(enrichmentQuery, [orgId, names]);
    const enrichmentByName = new Map<string, any>();
    for (const row of enrichmentResult.rows) {
      enrichmentByName.set(row.name, row);
    }
    return rows.map((row) => {
      const enrichment = enrichmentByName.get(String(row.name || '')) || {};
      return {
        ...row,
        version_count: enrichment.version_count || 0,
        install_count: enrichment.install_count || 0,
        usage_30d: enrichment.usage_30d || 0,
        error_rate_30d: enrichment.error_rate_30d || 0,
        review_count: enrichment.review_count || 0,
        average_rating: enrichment.average_rating || 0,
        verified: Boolean(row.publisher_trusted) && Boolean(enrichment._is_verified),
      };
    });
  } catch {
    return rows.map((row) => ({
      ...row,
      version_count: 0,
      install_count: 0,
      usage_30d: 0,
      error_rate_30d: 0,
      review_count: 0,
      average_rating: 0,
      verified: false,
    }));
  }
}

async function getRegistryMarketplaceEmbedding(
  pool: pg.Pool,
  entryId: string,
  text: string,
): Promise<number[] | null> {
  if (!entryId || !text) return null;
  const cacheKey = generateRegistryMarketplaceEmbeddingCacheKey(entryId, text);
  const cached = await getCachedRegistryMarketplaceEmbedding(pool, cacheKey);
  if (cached) return cached;
  const embedding = await embedTextFromEnv(text, {
    ...process.env,
    EMBEDDINGS_CACHE_ENABLED: 'false',
  } as NodeJS.ProcessEnv);
  if (embedding && embedding.length > 0) {
    await cacheRegistryMarketplaceEmbedding(pool, cacheKey, embedding);
  }
  return embedding;
}

async function requireTenantMembership(pool: pg.Pool, request: any, reply: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  const userId = String(request.userId || '').trim();
  if (!orgId) {
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return null;
  }
  const membership = await pool.query(
    `SELECT role
       FROM organization_memberships
      WHERE organization_id = $1
        AND user_id = $2
        AND status = 'active'
      LIMIT 1`,
    [orgId, userId],
  );
  if (membership.rows.length === 0) {
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Active organization membership required' },
    });
    return null;
  }
  request.tenantRole = String(membership.rows[0]?.role || '');
  return orgId;
}

const VALID_REVIEW_RATING = new Set([1, 2, 3, 4, 5]);

export async function registerRegistryRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  app.get('/v1/registry/catalog', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const query = request.query as { name?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.name) {
      params.push(`%${query.name}%`);
      where += ` AND name ILIKE $${params.length}`;
    }

    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM skills_catalog ${where}`, params);
      const total = countRes.rows[0].total;
      const dataParams = [...params, perPage, offset];
      const rows = await pool.query(
        `SELECT id, source_id, publisher_id, name, description, version, format, manifest, created_at
         FROM skills_catalog ${where}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );
      reply.send({
        success: true,
        data: rows.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'catalog');
        return;
      }
      throw err;
    }
  });

  app.get('/v1/registry/marketplace', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const query = request.query as { name?: string; semantic_query?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;
    const semanticQuery = normalizeSemanticQuery(query.semantic_query);

    let where = 'WHERE c.organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.name) {
      params.push(`%${query.name}%`);
      where += ` AND c.name ILIKE $${params.length}`;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM (
           SELECT DISTINCT ON (name) name
           FROM skills_catalog c
           ${where}
           ORDER BY name, created_at DESC
         ) latest`,
        params,
      );
      const total = countRes.rows[0].total;

      const latestRowsSql =
        `SELECT DISTINCT ON (c.name)
            c.id,
            c.source_id,
            c.publisher_id,
            c.name,
            c.description,
            c.version,
            c.format,
            c.manifest,
            c.created_at,
            COALESCE(rp.trusted, FALSE) AS publisher_trusted,
            COALESCE(c.manifest->>'changelog', '') AS changelog,
            COALESCE(c.manifest->>'deprecation_notice', '') AS deprecation_notice,
            CASE
              WHEN LOWER(COALESCE(c.manifest->>'deprecated', 'false')) IN ('true', '1', 'yes', 'y')
                THEN TRUE
              ELSE FALSE
            END AS deprecated,
            COALESCE(mr.is_premium, FALSE) AS is_premium,
            COALESCE(mr.price_cents, 0) AS price_cents,
            COALESCE(mr.currency, 'USD') AS currency,
            COALESCE(mr.creator_share_bps, 7000) AS creator_share_bps
         FROM skills_catalog c
         LEFT JOIN registry_publishers rp
           ON rp.id = c.publisher_id
          AND rp.organization_id = c.organization_id
         LEFT JOIN skill_monetization_rules mr
           ON mr.catalog_entry_id = c.id
          AND mr.organization_id = c.organization_id
          AND mr.enabled = TRUE
         ${where}
         ORDER BY c.name, c.created_at DESC`;

      if (!semanticQuery) {
        const dataParams = [...params, perPage, offset];
        const rows = await pool.query(
          `${latestRowsSql}
           LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
          dataParams,
        );
        const enrichedRows = await enrichRegistryMarketplaceRows(pool, orgId, rows.rows);
        reply.send({
          success: true,
          data: enrichedRows,
          meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
        });
        return;
      }

      const rawRows = await pool.query(latestRowsSql, params);
      const rows = {
        rows: await enrichRegistryMarketplaceRows(pool, orgId, rawRows.rows),
      };
      const queryEmbedding = await embedTextFromEnv(semanticQuery, {
        ...process.env,
        EMBEDDINGS_CACHE_ENABLED: 'false',
      } as NodeJS.ProcessEnv);

      const semanticMap = new Map<string, { semanticText: string; cacheKey: string }>();
      const cacheKeysToFetch: string[] = [];

      if (queryEmbedding) {
        for (const row of rows.rows) {
          const entryId = String(row.id || '');
          const semanticText = buildRegistryMarketplaceSemanticText(row as Record<string, unknown>);
          if (semanticText) {
            const cacheKey = generateRegistryMarketplaceEmbeddingCacheKey(entryId, semanticText);
            semanticMap.set(entryId, { semanticText, cacheKey });
            cacheKeysToFetch.push(cacheKey);
          }
        }
      }

      const cachedEmbeddings = await getCachedRegistryMarketplaceEmbeddings(pool, cacheKeysToFetch);

      const scoredRows = await Promise.all(
        rows.rows.map(async (row) => {
          let documentEmbedding: number[] | null = null;
          const entryId = String(row.id || '');
          const semanticInfo = semanticMap.get(entryId);

          if (queryEmbedding && semanticInfo) {
            const cached = cachedEmbeddings.get(semanticInfo.cacheKey);
            if (cached) {
              documentEmbedding = cached;
            } else {
              const embedding = await embedTextFromEnv(semanticInfo.semanticText, {
                ...process.env,
                EMBEDDINGS_CACHE_ENABLED: 'false',
              } as NodeJS.ProcessEnv);
              if (embedding && embedding.length > 0) {
                await cacheRegistryMarketplaceEmbedding(pool, semanticInfo.cacheKey, embedding);
              }
              documentEmbedding = embedding;
            }
          }
          const semanticScore =
            queryEmbedding && documentEmbedding
              ? cosineSimilarity(queryEmbedding, documentEmbedding)
              : 0;
          return {
            ...row,
            semantic_score: Number(semanticScore.toFixed(6)),
          };
        }),
      );

      scoredRows.sort((left, right) => {
        const semanticDelta = Number(right.semantic_score || 0) - Number(left.semantic_score || 0);
        if (semanticDelta !== 0) return semanticDelta;
        const ratingDelta = Number(right.average_rating || 0) - Number(left.average_rating || 0);
        if (ratingDelta !== 0) return ratingDelta;
        const reviewDelta = Number(right.review_count || 0) - Number(left.review_count || 0);
        if (reviewDelta !== 0) return reviewDelta;
        const installDelta = Number(right.install_count || 0) - Number(left.install_count || 0);
        if (installDelta !== 0) return installDelta;
        return new Date(String(right.created_at || 0)).getTime() - new Date(String(left.created_at || 0)).getTime();
      });

      const pagedRows = scoredRows.slice(offset, offset + perPage);
      reply.send({
        success: true,
        data: pagedRows,
        meta: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
          semantic_query: semanticQuery,
          semantic_search_applied: Boolean(queryEmbedding),
        },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'marketplace');
        return;
      }
      throw err;
    }
  });

  app.get('/v1/registry/versions', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const query = request.query as { name?: string; page?: string; per_page?: string };
    const name = String(query.name || '').trim();
    if (!name) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name query parameter is required' } });
      return;
    }
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM skills_catalog
         WHERE organization_id = $1 AND name = $2`,
        [orgId, name],
      );
      const total = countRes.rows[0].total;

      const rows = await pool.query(
        `SELECT
            id,
            source_id,
            publisher_id,
            name,
            description,
            version,
            format,
            manifest,
            created_at,
            COALESCE(manifest->>'changelog', '') AS changelog,
            COALESCE(manifest->>'deprecation_notice', '') AS deprecation_notice,
            CASE
              WHEN LOWER(COALESCE(manifest->>'deprecated', 'false')) IN ('true', '1', 'yes', 'y')
                THEN TRUE
              ELSE FALSE
            END AS deprecated
         FROM skills_catalog
         WHERE organization_id = $1 AND name = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [orgId, name, perPage, offset],
      );

      reply.send({
        success: true,
        data: rows.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'versions');
        return;
      }
      throw err;
    }
  });

  app.get('/v1/registry/reviews', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const query = request.query as { catalog_entry_id?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE sr.organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.catalog_entry_id) {
      params.push(query.catalog_entry_id);
      where += ` AND sr.catalog_entry_id = $${params.length}`;
    }

    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM skill_reviews sr ${where}`, params);
      const total = countRes.rows[0].total;
      const dataParams = [...params, perPage, offset];
      const rows = await pool.query(
        `SELECT
            sr.id,
            sr.catalog_entry_id,
            sr.reviewer_user_id,
            sr.rating,
            sr.review,
            sr.created_at,
            sr.updated_at,
            u.username,
            u.display_name
         FROM skill_reviews sr
         LEFT JOIN users u ON u.id = sr.reviewer_user_id
         ${where}
         ORDER BY sr.updated_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );
      reply.send({
        success: true,
        data: rows.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'reviews');
        return;
      }
      throw err;
    }
  });

  app.get('/v1/registry/installed', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const query = request.query as { trust_level?: string; tool_id?: string; catalog_entry_id?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.trust_level) {
      params.push(query.trust_level);
      where += ` AND trust_level = $${params.length}`;
    }
    if (query.tool_id) {
      params.push(query.tool_id);
      where += ` AND tool_id = $${params.length}`;
    }
    if (query.catalog_entry_id) {
      params.push(query.catalog_entry_id);
      where += ` AND catalog_entry_id = $${params.length}`;
    }

    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM skills_installed ${where}`, params);
      const total = countRes.rows[0].total;
      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at
         FROM skills_installed ${where}
         ORDER BY installed_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );
      reply.send({
        success: true,
        data: result.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'installed');
        return;
      }
      throw err;
    }
  });

  app.post('/v1/registry/install/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const { id } = request.params as { id: string };
    const userId = String(request.userId || '').trim();
    const catalog = await pool.query(
      `SELECT id, name, manifest
       FROM skills_catalog
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (catalog.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
      return;
    }
    const manifest = (catalog.rows[0].manifest || {}) as Record<string, unknown>;
    const toolId = String(manifest.tool_id || '').trim();
    if (!toolId) {
      reply.status(409).send({
        success: false,
        error: { code: 'INVALID_MANIFEST', message: 'Catalog manifest is missing tool_id' },
      });
      return;
    }

    try {
      const trustLevel = 'quarantined';
      const inserted = await pool.query(
        `INSERT INTO skills_installed (id, organization_id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT DO NOTHING
         RETURNING id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at`,
        [uuidv7(), orgId, id, toolId, trustLevel, userId],
      );
      const insertedNew = inserted.rows.length > 0;
      const installRow = insertedNew
        ? inserted.rows[0]
        : (
            await pool.query(
              `SELECT id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at
               FROM skills_installed
               WHERE organization_id = $1
                 AND (catalog_entry_id = $2 OR tool_id = $3)
               ORDER BY installed_at DESC
               LIMIT 1`,
              [orgId, id, toolId],
            )
          ).rows[0];
      if (!installRow) {
        reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL', message: 'Registry install could not be resolved after conflict handling' },
        });
        return;
      }

      if (!insertedNew) {
        reply.send({
          success: true,
          data: {
            ...installRow,
            installed: false,
            exists: true,
          },
        });
        return;
      }

      reply.status(201).send({
        success: true,
        data: {
          id: String(installRow.id || ''),
          catalog_entry_id: id,
          tool_id: toolId,
          trust_level: trustLevel,
          installed: true,
        },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'install');
        return;
      }
      throw err;
    }
  });

  app.post('/v1/registry/purchase/:id', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const { id } = request.params as { id: string };
    const userId = String(request.userId || '').trim();
    try {
      const catalog = await pool.query(
        `SELECT id, name, version
         FROM skills_catalog
         WHERE id = $1 AND organization_id = $2`,
        [id, orgId],
      );
      if (catalog.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
        return;
      }
      const monetization = await pool.query(
        `SELECT id, creator_user_id, is_premium, price_cents, currency, creator_share_bps, enabled
         FROM skill_monetization_rules
         WHERE organization_id = $1 AND catalog_entry_id = $2
         LIMIT 1`,
        [orgId, id],
      );
      if (monetization.rows.length === 0 || !monetization.rows[0].enabled) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Monetization rule not found for skill' } });
        return;
      }
      const rule = monetization.rows[0];
      if (!rule.is_premium) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Skill is not marked premium' } });
        return;
      }
      const amountCents = Number(rule.price_cents || 0);
      const shareBps = Number(rule.creator_share_bps || 0);
      const creatorAmountCents = Math.floor((amountCents * shareBps) / 10000);
      const platformAmountCents = amountCents - creatorAmountCents;
      const purchase = await pool.query(
        `INSERT INTO skill_purchase_events (
            id, organization_id, catalog_entry_id, monetization_rule_id, buyer_user_id, creator_user_id,
            amount_cents, creator_amount_cents, platform_amount_cents, currency, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'recorded', NOW())
         RETURNING id, catalog_entry_id, buyer_user_id, creator_user_id, amount_cents, creator_amount_cents, platform_amount_cents, currency, status, created_at`,
        [
          uuidv7(),
          orgId,
          id,
          String(rule.id),
          userId,
          rule.creator_user_id ? String(rule.creator_user_id) : null,
          amountCents,
          creatorAmountCents,
          platformAmountCents,
          String(rule.currency || 'USD'),
        ],
      );
      reply.status(201).send({
        success: true,
        data: {
          ...purchase.rows[0],
          skill_name: String(catalog.rows[0].name || ''),
          skill_version: String(catalog.rows[0].version || ''),
          split: {
            creator_share_bps: shareBps,
            creator_amount_cents: creatorAmountCents,
            platform_amount_cents: platformAmountCents,
          },
        },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'purchase');
        return;
      }
      throw err;
    }
  });

  app.post('/v1/registry/reviews', { preHandler: requireAuth }, async (request: any, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const userId = String(request.userId || '').trim();
    const body = (request.body || {}) as { catalog_entry_id?: string; rating?: number; review?: string };
    const catalogEntryId = String(body.catalog_entry_id || '').trim();
    if (!catalogEntryId) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'catalog_entry_id is required' } });
      return;
    }
    const rating = Number(body.rating);
    if (!VALID_REVIEW_RATING.has(rating)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'rating must be an integer between 1 and 5' } });
      return;
    }
    const reviewText = String(body.review || '').trim();
    if (reviewText.length > 2000) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'review exceeds 2000 characters' } });
      return;
    }
    const catalogExists = await pool.query(
      'SELECT 1 FROM skills_catalog WHERE id = $1 AND organization_id = $2',
      [catalogEntryId, orgId],
    );
    if (catalogExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
      return;
    }
    try {
      const row = await pool.query(
        `INSERT INTO skill_reviews (
            id, organization_id, catalog_entry_id, reviewer_user_id, rating, review, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (organization_id, catalog_entry_id, reviewer_user_id)
         DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review, updated_at = NOW()
         RETURNING id, catalog_entry_id, reviewer_user_id, rating, review, created_at, updated_at`,
        [uuidv7(), orgId, catalogEntryId, userId, rating, reviewText || null],
      );
      reply.status(201).send({ success: true, data: row.rows[0] });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'reviews');
        return;
      }
      throw err;
    }
  });
}
