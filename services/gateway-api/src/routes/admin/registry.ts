import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { createLogger } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';
import { getIncidentStatus } from '../../services/IncidentService.js';
import { embedTextFromEnv } from '../../services/embeddings.js';

const logger = createLogger('admin-registry');

const VALID_SOURCE_TYPES = ['public', 'private', 'local'] as const;
const VALID_TRUST_LEVELS = ['trusted', 'quarantined', 'blocked'] as const;
const VALID_SKILL_FORMATS = ['openclaw', 'oci', 'nix'] as const;
const VALID_RISK = ['low', 'medium', 'high', 'critical', 'unknown'] as const;
const VALID_REVIEW_RATING = [1, 2, 3, 4, 5] as const;
const REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME = 'registry.marketplace.embedding';

class RegistrySchemaUnavailableError extends Error {}

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

function decodeSignatureValue(signature: string): Buffer | null {
  const raw = String(signature || '').trim();
  if (!raw) return null;

  const normalizedBase64Url = raw.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = normalizedBase64Url + '='.repeat((4 - (normalizedBase64Url.length % 4)) % 4);

  const base64Candidate = Buffer.from(paddedBase64, 'base64');
  if (base64Candidate.length > 0 && base64Candidate.toString('base64').replace(/=+$/g, '') === paddedBase64.replace(/=+$/g, '')) {
    return base64Candidate;
  }

  if (/^[a-fA-F0-9]+$/.test(raw) && raw.length % 2 === 0) {
    return Buffer.from(raw, 'hex');
  }
  return null;
}

function normalizeSignatureType(value: unknown): string {
  return String(value || 'cosign').trim().toLowerCase();
}

function verifyDetachedSignature(params: {
  signatureType: string;
  payload: string;
  signature: string;
  publicKeyPem: string;
}): { ok: true } | { ok: false; message: string } {
  const payload = String(params.payload || '');
  if (!payload) {
    return { ok: false, message: 'payload is required for verification' };
  }
  const signatureBytes = decodeSignatureValue(params.signature);
  if (!signatureBytes) {
    return { ok: false, message: 'signature must be base64/base64url or hex encoded' };
  }

  const signatureType = normalizeSignatureType(params.signatureType);
  let verified = false;
  try {
    const publicKey = createPublicKey(params.publicKeyPem);
    if (signatureType === 'ed25519') {
      verified = verifySignature(null, Buffer.from(payload, 'utf8'), publicKey, signatureBytes);
    } else if (signatureType === 'rsa-sha256' || signatureType === 'ecdsa-sha256') {
      verified = verifySignature('sha256', Buffer.from(payload, 'utf8'), publicKey, signatureBytes);
    } else {
      return { ok: false, message: `unsupported signature_type: ${signatureType}` };
    }
  } catch (err) {
    return {
      ok: false,
      message: `signature verification failed: ${String(err instanceof Error ? err.message : err)}`,
    };
  }
  if (!verified) {
    return { ok: false, message: 'signature did not verify against supplied payload/public key' };
  }
  return { ok: true };
}

function parseOptionalBoolean(raw: unknown): { valid: boolean; value: boolean | undefined } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: raw };
}

function normalizeRegistryBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

function validateRegistryCatalogManifest(
  format: string,
  manifest: unknown,
): { ok: true } | { ok: false; message: string } {
  if (manifest === undefined) return { ok: true };
  if (!isObjectRecord(manifest)) {
    return { ok: false, message: 'manifest must be an object when provided' };
  }
  if (format !== 'nix') {
    return { ok: true };
  }

  const toolId = String(manifest.tool_id || '').trim();
  const flakeRef = String(manifest.flake_ref || '').trim();
  const packageAttr = String(manifest.package_attr || '').trim();
  const binary = String(manifest.binary || '').trim();
  if (!toolId) {
    return { ok: false, message: 'nix manifest requires tool_id' };
  }
  if (!flakeRef) {
    return { ok: false, message: 'nix manifest requires flake_ref' };
  }
  if (!packageAttr) {
    return { ok: false, message: 'nix manifest requires package_attr' };
  }
  if (!binary) {
    return { ok: false, message: 'nix manifest requires binary' };
  }
  return { ok: true };
}

async function enforceRegistryInstallIncidentGuard(reply: any): Promise<boolean> {
  const status = await getIncidentStatus();
  if (!status.killSwitchActive && !status.lockdownActive && !status.forensicsActive) return true;

  reply.status(423).send({
    success: false,
    error: {
      code: 'INCIDENT_WRITE_BLOCKED',
      message: 'Registry install and trust mutation operations are blocked while incident controls are active',
    },
    data: {
      incident_status: status.status,
    },
  });
  return false;
}

async function ensureTrustedPromotionPreconditions(
  pool: pg.Pool,
  opts: {
    organizationId: string | null;
    installedSkillId: string;
    reviewerId: string | null;
    reviewReason: string;
  },
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  if (!opts.organizationId) {
    return { ok: false, status: 403, code: 'ORG_REQUIRED', message: 'Active account required' };
  }
  const reason = String(opts.reviewReason || '').trim();
  if (!reason) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION',
      message: 'review_reason is required for trusted promotion',
    };
  }
  const reviewer = String(opts.reviewerId || '').trim();
  if (!reviewer) {
    return {
      ok: false,
      status: 403,
      code: 'AUTH_REQUIRED',
      message: 'Authenticated reviewer is required for trusted promotion',
    };
  }

  const reportRes = await pool.query(
    `SELECT id
       FROM skill_quarantine_reports
      WHERE organization_id = $1
        AND skill_id = $2
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND COALESCE(static_checks->>'status', '') = 'pass'
        AND overall_risk IN ('low', 'medium')
      ORDER BY reviewed_at DESC, created_at DESC
      LIMIT 1`,
    [opts.organizationId, opts.installedSkillId],
  );
  if (reportRes.rows.length === 0) {
    return {
      ok: false,
      status: 409,
      code: 'REVIEW_REQUIRED',
      message: 'Trusted promotion requires a reviewed quarantine report with passing checks and acceptable risk',
    };
  }

  return { ok: true };
}

function parseStrictFlag(raw: string | undefined): boolean {
  const normalized = String(raw || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
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
       SET cached_output = $3,
           expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
           updated_at = CURRENT_TIMESTAMP`,
      [REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME, cacheKey, JSON.stringify(embedding)],
    );
  } catch {
    // Semantic cache persistence is opportunistic; search still works without it.
  }
}

async function cacheRegistryMarketplaceEmbeddings(
  pool: pg.Pool,
  entries: { cacheKey: string; embedding: number[] }[],
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const values: string[] = [];
    const params: unknown[] = [REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME];
    let paramOffset = 2;

    for (const entry of entries) {
      values.push(`($1, $${paramOffset}, $${paramOffset + 1}, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP)`);
      params.push(entry.cacheKey, JSON.stringify(entry.embedding));
      paramOffset += 2;
    }

    await pool.query(
      `INSERT INTO tool_cache (tool_name, cache_key, cached_output, expires_at, created_at)
       VALUES ${values.join(', ')}
       ON CONFLICT (tool_name, cache_key) DO UPDATE
       SET cached_output = EXCLUDED.cached_output,
           expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
           updated_at = CURRENT_TIMESTAMP`,
      params,
    );
  } catch {
    // Semantic cache persistence is opportunistic; search still works without it.
  }
}

async function getRegistryMarketplaceEmbedding(pool: pg.Pool, entryId: string, text: string): Promise<number[] | null> {
  const cacheKey = generateRegistryMarketplaceEmbeddingCacheKey(entryId, text);
  const cached = await getCachedRegistryMarketplaceEmbedding(pool, cacheKey);
  if (cached) return cached;
  const embedding = await embedTextFromEnv(text, {
    ...process.env,
    EMBEDDINGS_CACHE_ENABLED: 'false',
  } as NodeJS.ProcessEnv);
  if (embedding) {
    await cacheRegistryMarketplaceEmbedding(pool, cacheKey, embedding);
  }
  return embedding;
}

function getQuarantineScanConfig() {
  const strict = parseStrictFlag(process.env.SVEN_SKILL_QUARANTINE_SCAN_STRICT);
  const sbomCommand = String(process.env.SVEN_SKILL_QUARANTINE_SBOM_COMMAND || '').trim();
  const vulnCommand = String(process.env.SVEN_SKILL_QUARANTINE_VULN_COMMAND || '').trim();
  return {
    strict,
    sbomCommand,
    vulnCommand,
    sbomConfigured: Boolean(sbomCommand),
    vulnConfigured: Boolean(vulnCommand),
  };
}

function buildQuarantineReportScanPayloads() {
  const config = getQuarantineScanConfig();
  const sbom = {
    status: 'pending',
    tool: 'syft',
    configured: config.sbomConfigured,
    ...(config.sbomConfigured ? { command: config.sbomCommand } : {}),
  };
  const vulnScan = {
    status: 'pending',
    tool: 'grype',
    configured: config.vulnConfigured,
    ...(config.vulnConfigured ? { command: config.vulnCommand } : {}),
  };
  return { config, sbom, vulnScan };
}

function ensureQuarantineScanConfiguredOrReply(reply: any): boolean {
  const config = getQuarantineScanConfig();
  if (!config.strict) return true;
  if (config.sbomConfigured && config.vulnConfigured) return true;
  reply.status(503).send({
    success: false,
    error: {
      code: 'QUARANTINE_SCAN_NOT_CONFIGURED',
      message: 'Strict quarantine scan mode requires both SBOM and vulnerability scanner commands',
    },
    data: {
      strict: true,
      sbom_configured: config.sbomConfigured,
      vuln_configured: config.vulnConfigured,
      required_env: ['SVEN_SKILL_QUARANTINE_SBOM_COMMAND', 'SVEN_SKILL_QUARANTINE_VULN_COMMAND'],
    },
  });
  return false;
}

export async function registerRegistryRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  app.addHook('preHandler', async (request: any, reply: any) => {
    if (!request.orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
  });

  // ─── Registry Sources ───────────────────────────────────────────────────
  app.get('/registry/sources', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as { type?: string; enabled?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];

    if (query.type) {
      params.push(query.type);
      where += ` AND type = $${params.length}`;
    }
    if (query.enabled !== undefined) {
      if (query.enabled !== 'true' && query.enabled !== 'false') {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'enabled query must be true or false when provided' },
        });
        return;
      }
      params.push(query.enabled === 'true');
      where += ` AND enabled = $${params.length}`;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM registry_sources ${where}`,
        params,
      );
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, name, type, url, path, enabled, created_at
         FROM registry_sources ${where}
         ORDER BY created_at DESC
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
        request.log.warn({ err }, 'registry sources schema not ready; fail-closed');
        sendRegistrySchemaUnavailable(reply, 'sources');
        return;
      }
      throw err;
    }
  });

  app.post('/registry/sources', async (request, reply) => {
    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{
      name?: string;
      type?: string;
      url?: string;
      path?: string;
      enabled?: boolean;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.name || body.name.trim().length < 2) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name must be at least 2 characters' } });
      return;
    }
    if (!body.type || !VALID_SOURCE_TYPES.includes(body.type as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `type must be one of: ${VALID_SOURCE_TYPES.join(', ')}` } });
      return;
    }

    if ((body.type === 'public' || body.type === 'private') && !body.url) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'url is required for public/private sources' } });
      return;
    }
    if (body.type === 'local' && !body.path) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'path is required for local sources' } });
      return;
    }

    const id = uuidv7();

    try {
      await pool.query(
        `INSERT INTO registry_sources (id, organization_id, name, type, url, path, enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [id, orgId, body.name.trim(), body.type, body.url || null, body.path || null, body.enabled ?? true],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Source name already exists' } });
        return;
      }
      throw err;
    }

    logger.info('Registry source created', { id, name: body.name, type: body.type });
    reply.status(201).send({ success: true, data: { id, name: body.name, type: body.type } });
  });

  app.patch('/registry/sources/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{ name?: string; type?: string; url?: string; path?: string; enabled?: boolean }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      if (body.name.trim().length < 2) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name must be at least 2 characters' } });
        return;
      }
      params.push(body.name.trim());
      sets.push(`name = $${params.length}`);
    }

    if (body.type !== undefined) {
      if (!VALID_SOURCE_TYPES.includes(body.type as any)) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `type must be one of: ${VALID_SOURCE_TYPES.join(', ')}` } });
        return;
      }
      params.push(body.type);
      sets.push(`type = $${params.length}`);
    }

    if (body.url !== undefined) {
      params.push(body.url || null);
      sets.push(`url = $${params.length}`);
    }

    if (body.path !== undefined) {
      params.push(body.path || null);
      sets.push(`path = $${params.length}`);
    }

    if (body.enabled !== undefined) {
      params.push(Boolean(body.enabled));
      sets.push(`enabled = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id, orgId);
    const res = await pool.query(
      `UPDATE registry_sources SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING id, name, type, url, path, enabled, created_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/registry/sources/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM registry_sources WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Registry Publishers ────────────────────────────────────────────────
  app.get('/registry/publishers', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as { trusted?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.trusted !== undefined) {
      if (query.trusted !== 'true' && query.trusted !== 'false') {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'trusted query must be true or false when provided' },
        });
        return;
      }
      params.push(query.trusted === 'true');
      where += ` AND trusted = $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM registry_publishers ${where}`,
      params,
    );
    const total = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, name, trusted, created_at
       FROM registry_publishers ${where}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  app.post('/registry/publishers', async (request, reply) => {
    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{ name?: string; trusted?: boolean }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.name || body.name.trim().length < 2) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name must be at least 2 characters' } });
      return;
    }
    const trustedParsed = parseOptionalBoolean((body as { trusted?: unknown }).trusted);
    if (!trustedParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'trusted must be a boolean when provided' },
      });
      return;
    }
    const trusted = trustedParsed.value ?? false;

    const id = uuidv7();
    try {
      await pool.query(
        `INSERT INTO registry_publishers (id, organization_id, name, trusted, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [id, orgId, body.name.trim(), trusted],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Publisher name already exists' } });
        return;
      }
      throw err;
    }

    logger.info('Registry publisher created', { id, name: body.name, trusted });
    reply.status(201).send({ success: true, data: { id, name: body.name, trusted } });
  });

  app.patch('/registry/publishers/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{ name?: string; trusted?: boolean }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      if (body.name.trim().length < 2) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name must be at least 2 characters' } });
        return;
      }
      params.push(body.name.trim());
      sets.push(`name = $${params.length}`);
    }

    if (body.trusted !== undefined) {
      const trustedParsed = parseOptionalBoolean((body as { trusted?: unknown }).trusted);
      if (!trustedParsed.valid) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'trusted must be a boolean when provided' },
        });
        return;
      }
      params.push(trustedParsed.value);
      sets.push(`trusted = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id, orgId);
    const res = await pool.query(
      `UPDATE registry_publishers SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING id, name, trusted, created_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Publisher not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/registry/publishers/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM registry_publishers WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Publisher not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Skills Catalog ─────────────────────────────────────────────────────
  app.get('/registry/catalog', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as {
      source_id?: string;
      publisher_id?: string;
      name?: string;
      format?: string;
      page?: string;
      per_page?: string;
    };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];

    if (query.source_id) {
      params.push(query.source_id);
      where += ` AND source_id = $${params.length}`;
    }
    if (query.publisher_id) {
      params.push(query.publisher_id);
      where += ` AND publisher_id = $${params.length}`;
    }
    if (query.name) {
      params.push(`%${query.name}%`);
      where += ` AND name ILIKE $${params.length}`;
    }
    if (query.format) {
      params.push(query.format);
      where += ` AND format = $${params.length}`;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM skills_catalog ${where}`,
        params,
      );
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, source_id, publisher_id, name, description, version, format, manifest, created_at
         FROM skills_catalog ${where}
         ORDER BY created_at DESC
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
        request.log.warn({ err }, 'registry catalog schema not ready; fail-closed');
        sendRegistrySchemaUnavailable(reply, 'catalog');
        return;
      }
      throw err;
    }
  });

  app.post('/registry/catalog', async (request, reply) => {
    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{
      source_id?: string;
      publisher_id?: string;
      name?: string;
      description?: string;
      version?: string;
      format?: string;
      manifest?: Record<string, unknown>;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.source_id || !body.name || !body.format) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'source_id, name, and format are required' } });
      return;
    }
    if (!VALID_SKILL_FORMATS.includes(body.format as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `format must be one of: ${VALID_SKILL_FORMATS.join(', ')}` } });
      return;
    }
    const manifestValidation = validateRegistryCatalogManifest(body.format, body.manifest);
    if (!manifestValidation.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: manifestValidation.message } });
      return;
    }

    const sourceExists = await pool.query('SELECT 1 FROM registry_sources WHERE id = $1 AND organization_id = $2', [body.source_id, orgId]);
    if (sourceExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });
      return;
    }

    if (body.publisher_id) {
      const publisherExists = await pool.query('SELECT 1 FROM registry_publishers WHERE id = $1 AND organization_id = $2', [body.publisher_id, orgId]);
      if (publisherExists.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Publisher not found' } });
        return;
      }
    }

    const id = uuidv7();
    try {
      await pool.query(
        `INSERT INTO skills_catalog (id, organization_id, source_id, publisher_id, name, description, version, format, manifest, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          id,
          orgId,
          body.source_id,
          body.publisher_id || null,
          body.name.trim(),
          body.description || '',
          body.version || '0.0.0',
          body.format,
          JSON.stringify(body.manifest || {}),
        ],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Catalog entry already exists' } });
        return;
      }
      throw err;
    }

    reply.status(201).send({ success: true, data: { id } });
  });

  app.patch('/registry/catalog/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{
      description?: string;
      version?: string;
      format?: string;
      manifest?: Record<string, unknown>;
      publisher_id?: string | null;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.description !== undefined) {
      params.push(body.description);
      sets.push(`description = $${params.length}`);
    }
    if (body.version !== undefined) {
      params.push(body.version);
      sets.push(`version = $${params.length}`);
    }
    if (body.format !== undefined) {
      if (!VALID_SKILL_FORMATS.includes(body.format as any)) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `format must be one of: ${VALID_SKILL_FORMATS.join(', ')}` } });
        return;
      }
      const manifestValidation = validateRegistryCatalogManifest(body.format, body.manifest);
      if (!manifestValidation.ok) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: manifestValidation.message } });
        return;
      }
      params.push(body.format);
      sets.push(`format = $${params.length}`);
    }
    if (body.manifest !== undefined && body.format === undefined) {
      const current = await pool.query(
        `SELECT format FROM skills_catalog WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [id, orgId],
      );
      if (current.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
        return;
      }
      const manifestValidation = validateRegistryCatalogManifest(String(current.rows[0].format || ''), body.manifest);
      if (!manifestValidation.ok) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: manifestValidation.message } });
        return;
      }
    }
    if (body.manifest !== undefined) {
      params.push(JSON.stringify(body.manifest));
      sets.push(`manifest = $${params.length}`);
    }
    if (body.publisher_id !== undefined) {
      if (body.publisher_id) {
        const pub = await pool.query('SELECT 1 FROM registry_publishers WHERE id = $1 AND organization_id = $2', [body.publisher_id, orgId]);
        if (pub.rows.length === 0) {
          reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Publisher not found' } });
          return;
        }
      }
      params.push(body.publisher_id || null);
      sets.push(`publisher_id = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id, orgId);
    const res = await pool.query(
      `UPDATE skills_catalog SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING id, source_id, publisher_id, name, description, version, format, manifest, created_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/registry/catalog/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM skills_catalog WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // Marketplace projection for Canvas/public directory:
  // latest version per skill name + verification + adoption/quality analytics.
  app.get('/registry/marketplace', async (request, reply) => {
    const orgId = currentOrgId(request);
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
            COALESCE(mr.creator_share_bps, 7000) AS creator_share_bps,
            (
              SELECT COUNT(*)::int
              FROM skills_catalog c2
              WHERE c2.organization_id = c.organization_id
                AND c2.name = c.name
            ) AS version_count,
            (
              SELECT COUNT(*)::int
              FROM skills_installed si
              JOIN skills_catalog c2
                ON c2.id = si.catalog_entry_id
               AND c2.organization_id = si.organization_id
              WHERE si.organization_id = c.organization_id
                AND c2.name = c.name
            ) AS install_count,
            (
              SELECT COUNT(DISTINCT tr.id)::int
              FROM tool_runs tr
              JOIN tools t
                ON t.name = tr.tool_name
              JOIN skills_installed si
                ON si.tool_id = t.id
               AND si.organization_id = c.organization_id
              JOIN skills_catalog c2
                ON c2.id = si.catalog_entry_id
               AND c2.organization_id = si.organization_id
              WHERE c2.name = c.name
                AND tr.created_at >= NOW() - INTERVAL '30 days'
            ) AS usage_30d,
            (
              SELECT COALESCE(
                ROUND(
                  (
                    COUNT(*) FILTER (WHERE tr.status IN ('error', 'timeout', 'denied'))::numeric
                    / NULLIF(COUNT(*), 0)
                  ),
                  4
                ),
                0
              )
              FROM tool_runs tr
              JOIN tools t
                ON t.name = tr.tool_name
              JOIN skills_installed si
                ON si.tool_id = t.id
               AND si.organization_id = c.organization_id
              JOIN skills_catalog c2
                ON c2.id = si.catalog_entry_id
               AND c2.organization_id = si.organization_id
              WHERE c2.name = c.name
                AND tr.created_at >= NOW() - INTERVAL '30 days'
            ) AS error_rate_30d,
            (
              SELECT MAX(tr.created_at)
              FROM tool_runs tr
              JOIN tools t
                ON t.name = tr.tool_name
              JOIN skills_installed si
                ON si.tool_id = t.id
               AND si.organization_id = c.organization_id
              JOIN skills_catalog c2
                ON c2.id = si.catalog_entry_id
               AND c2.organization_id = si.organization_id
              WHERE c2.name = c.name
            ) AS last_used_at,
            (
              SELECT COUNT(sr.id)::int
              FROM skill_reviews sr
              JOIN skills_catalog c2
                ON c2.id = sr.catalog_entry_id
               AND c2.organization_id = sr.organization_id
              WHERE sr.organization_id = c.organization_id
                AND c2.name = c.name
            ) AS review_count,
            (
              SELECT COALESCE(ROUND(AVG(sr.rating)::numeric, 2), 0)
              FROM skill_reviews sr
              JOIN skills_catalog c2
                ON c2.id = sr.catalog_entry_id
               AND c2.organization_id = sr.organization_id
              WHERE sr.organization_id = c.organization_id
                AND c2.name = c.name
            ) AS average_rating,
            (
              COALESCE(rp.trusted, FALSE)
              AND EXISTS (
                SELECT 1
                FROM skills_installed si
                JOIN skills_catalog c2
                  ON c2.id = si.catalog_entry_id
                 AND c2.organization_id = si.organization_id
                WHERE si.organization_id = c.organization_id
                  AND c2.name = c.name
                  AND si.trust_level = 'trusted'
              )
              AND EXISTS (
                SELECT 1
                FROM skill_signatures ss
                JOIN skills_installed si
                  ON si.id = ss.skill_id
                 AND si.organization_id = ss.organization_id
                JOIN skills_catalog c2
                  ON c2.id = si.catalog_entry_id
                 AND c2.organization_id = si.organization_id
                WHERE ss.organization_id = c.organization_id
                  AND c2.name = c.name
                  AND ss.verified = TRUE
              )
              AND NOT EXISTS (
                SELECT 1
                FROM skill_quarantine_reports qr
                JOIN skills_installed si
                  ON si.id = qr.skill_id
                 AND si.organization_id = qr.organization_id
                JOIN skills_catalog c2
                  ON c2.id = si.catalog_entry_id
                 AND c2.organization_id = si.organization_id
                WHERE qr.organization_id = c.organization_id
                  AND c2.name = c.name
                  AND qr.overall_risk IN ('high', 'critical')
              )
            ) AS verified
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

        reply.send({
          success: true,
          data: rows.rows,
          meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
        });
        return;
      }

      const rows = await pool.query(latestRowsSql, params);
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

      const embeddingsToCache: { cacheKey: string; embedding: number[] }[] = [];

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
                embeddingsToCache.push({ cacheKey: semanticInfo.cacheKey, embedding });
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

      if (embeddingsToCache.length > 0) {
        await cacheRegistryMarketplaceEmbeddings(pool, embeddingsToCache);
      }

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

  app.get('/registry/versions', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as { name?: string; page?: string; per_page?: string };
    const name = String(query.name || '').trim();
    if (!name) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name query parameter is required' },
      });
      return;
    }

    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;
    const params: unknown[] = [orgId, name];

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM skills_catalog
         WHERE organization_id = $1 AND name = $2`,
        params,
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
        [...params, perPage, offset],
      );

      reply.send({
        success: true,
        data: rows.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        request.log.warn({ err }, 'registry versions schema not ready; fail-closed');
        sendRegistrySchemaUnavailable(reply, 'versions');
        return;
      }
      throw err;
    }
  });

  app.get('/registry/reviews', async (request, reply) => {
    const orgId = currentOrgId(request);
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
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM skill_reviews sr
         ${where}`,
        params,
      );
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
        request.log.warn({ err }, 'skill reviews schema not ready; fail-closed');
        sendRegistrySchemaUnavailable(reply, 'reviews');
        return;
      }
      throw err;
    }
  });

  app.get('/registry/monetization', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as { catalog_entry_id?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE m.organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.catalog_entry_id) {
      params.push(query.catalog_entry_id);
      where += ` AND m.catalog_entry_id = $${params.length}`;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM skill_monetization_rules m ${where}`,
        params,
      );
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const rows = await pool.query(
        `SELECT
            m.id,
            m.catalog_entry_id,
            m.creator_user_id,
            m.is_premium,
            m.price_cents,
            m.currency,
            m.creator_share_bps,
            m.enabled,
            m.created_at,
            m.updated_at,
            c.name AS skill_name,
            c.version AS skill_version,
            u.username AS creator_username,
            u.display_name AS creator_display_name
         FROM skill_monetization_rules m
         JOIN skills_catalog c
           ON c.id = m.catalog_entry_id
          AND c.organization_id = m.organization_id
         LEFT JOIN users u
           ON u.id = m.creator_user_id
         ${where}
         ORDER BY m.updated_at DESC
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
        request.log.warn({ err }, 'skill monetization schema not ready; fail-closed');
        sendRegistrySchemaUnavailable(reply, 'monetization');
        return;
      }
      throw err;
    }
  });

  app.post('/registry/monetization', async (request, reply) => {
    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{
      catalog_entry_id?: string;
      creator_user_id?: string | null;
      is_premium?: boolean;
      price_cents?: number;
      currency?: string;
      creator_share_bps?: number;
      enabled?: boolean;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.catalog_entry_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'catalog_entry_id is required' } });
      return;
    }
    const isPremiumParsed = parseOptionalBoolean((body as { is_premium?: unknown }).is_premium);
    if (!isPremiumParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'is_premium must be a boolean when provided' },
      });
      return;
    }
    const enabledParsed = parseOptionalBoolean((body as { enabled?: unknown }).enabled);
    if (!enabledParsed.valid) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
      });
      return;
    }

    const priceCents = Math.max(0, Number.parseInt(String(body.price_cents ?? 0), 10) || 0);
    const creatorShareBps = Number.parseInt(String(body.creator_share_bps ?? 7000), 10) || 7000;
    if (creatorShareBps < 0 || creatorShareBps > 10000) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'creator_share_bps must be between 0 and 10000' } });
      return;
    }
    const currency = String(body.currency || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'currency must be a 3-letter ISO code' } });
      return;
    }
    const isPremium = isPremiumParsed.value ?? false;
    if (isPremium && priceCents <= 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'premium skills require price_cents > 0' } });
      return;
    }

    const catalogExists = await pool.query(
      'SELECT 1 FROM skills_catalog WHERE id = $1 AND organization_id = $2',
      [body.catalog_entry_id, orgId],
    );
    if (catalogExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
      return;
    }

    if (body.creator_user_id) {
      const creatorMembership = await pool.query(
        `SELECT 1
           FROM organization_memberships
          WHERE organization_id = $1
            AND user_id = $2
            AND status = 'active'
          LIMIT 1`,
        [orgId, body.creator_user_id],
      );
      if (creatorMembership.rows.length === 0) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Creator user not found in active organization' },
        });
        return;
      }
    }

    try {
      const row = await pool.query(
        `INSERT INTO skill_monetization_rules (
            id, organization_id, catalog_entry_id, creator_user_id, is_premium, price_cents, currency, creator_share_bps, enabled, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (organization_id, catalog_entry_id)
         DO UPDATE SET
            creator_user_id = EXCLUDED.creator_user_id,
            is_premium = EXCLUDED.is_premium,
            price_cents = EXCLUDED.price_cents,
            currency = EXCLUDED.currency,
            creator_share_bps = EXCLUDED.creator_share_bps,
            enabled = EXCLUDED.enabled,
            updated_at = NOW()
         RETURNING id, catalog_entry_id, creator_user_id, is_premium, price_cents, currency, creator_share_bps, enabled, created_at, updated_at`,
        [
          uuidv7(),
          orgId,
          body.catalog_entry_id,
          body.creator_user_id || null,
          isPremium,
          priceCents,
          currency,
          creatorShareBps,
          enabledParsed.value ?? true,
        ],
      );
      reply.status(201).send({ success: true, data: row.rows[0] });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Skill monetization schema not available in this environment' },
        });
        return;
      }
      throw err;
    }
  });

  app.post('/registry/purchase/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const userId = (request as any).userId ? String((request as any).userId) : null;
    if (!userId) {
      reply.status(401).send({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Login required' } });
      return;
    }

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
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Skill purchase schema not available in this environment' },
        });
        return;
      }
      throw err;
    }
  });

  app.get('/registry/payouts/summary', async (request, reply) => {
    const orgId = currentOrgId(request);
    try {
      const rows = await pool.query(
        `SELECT
            pe.creator_user_id,
            COALESCE(u.username, 'unknown') AS creator_username,
            COALESCE(u.display_name, '') AS creator_display_name,
            COUNT(*)::int AS purchase_count,
            COALESCE(SUM(pe.amount_cents), 0)::int AS gross_amount_cents,
            COALESCE(SUM(pe.creator_amount_cents), 0)::int AS creator_amount_cents,
            COALESCE(SUM(pe.platform_amount_cents), 0)::int AS platform_amount_cents
         FROM skill_purchase_events pe
         LEFT JOIN users u ON u.id = pe.creator_user_id
         WHERE pe.organization_id = $1
           AND pe.status = 'recorded'
         GROUP BY pe.creator_user_id, u.username, u.display_name
         ORDER BY creator_amount_cents DESC`,
        [orgId],
      );
      reply.send({ success: true, data: rows.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'payouts');
        return;
      }
      throw err;
    }
  });

  app.post('/registry/reviews', async (request, reply) => {
    const orgId = currentOrgId(request);
    const userId = (request as any).userId ? String((request as any).userId) : null;
    if (!userId) {
      reply.status(401).send({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Login required' } });
      return;
    }

    const bodyParsed = normalizeRegistryBody<{
      catalog_entry_id?: string;
      rating?: number;
      review?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.catalog_entry_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'catalog_entry_id is required' } });
      return;
    }
    const rating = Number(body.rating);
    if (!VALID_REVIEW_RATING.includes(rating as any)) {
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
      [body.catalog_entry_id, orgId],
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
        [uuidv7(), orgId, body.catalog_entry_id, userId, rating, reviewText || null],
      );

      reply.status(201).send({ success: true, data: row.rows[0] });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Skill review schema not available in this environment' },
        });
        return;
      }
      throw err;
    }
  });

  // ─── Skills Installed ───────────────────────────────────────────────────
  app.get('/registry/installed', async (request, reply) => {
    const orgId = currentOrgId(request);
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
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM skills_installed ${where}`,
        params,
      );
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

  // Backward-compat action aliases expected by admin UI.
  app.post('/registry/install/:id', async (request, reply) => {
    if (!(await enforceRegistryInstallIncidentGuard(reply))) return;

    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const userId = (request as any).userId ? String((request as any).userId) : null;
    if (!userId) {
      reply.status(401).send({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Login required' } });
      return;
    }

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
    const toolId = typeof manifest.tool_id === 'string' ? manifest.tool_id.trim() : '';
    if (!toolId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Catalog entry is missing manifest.tool_id mapping' },
      });
      return;
    }

    const toolExists = await pool.query(`SELECT id FROM tools WHERE id = $1`, [toolId]);
    if (toolExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tool not found' } });
      return;
    }

    const trustLevel = manifest.first_party === true ? 'trusted' : 'quarantined';
    const attemptedInstallId = uuidv7();
    const inserted = await pool.query(
      `INSERT INTO skills_installed (id, organization_id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at`,
      [attemptedInstallId, orgId, id, toolId, trustLevel, userId],
    );
    const insertedNew = inserted.rows.length > 0;
    const installRow = insertedNew
      ? inserted.rows[0]
      : (
          await pool.query(
            `SELECT id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at
             FROM skills_installed
             WHERE organization_id = $1 AND (catalog_entry_id = $2 OR tool_id = $3)
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
    const installId = String(installRow.id);

    if (insertedNew && trustLevel === 'quarantined') {
      if (!ensureQuarantineScanConfiguredOrReply(reply)) return;
      const staticChecks = { status: 'pending', checks: [] };
      const { sbom, vulnScan } = buildQuarantineReportScanPayloads();
      await pool.query(
        `INSERT INTO skill_quarantine_reports (id, skill_id, organization_id, static_checks, sbom, vuln_scan, overall_risk, reviewed_by, reviewed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [uuidv7(), installId, orgId, JSON.stringify(staticChecks), JSON.stringify(sbom), JSON.stringify(vulnScan), 'unknown', null, null],
      );
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
        id: installId,
        catalog_entry_id: id,
        tool_id: toolId,
        trust_level: trustLevel,
        installed: true,
      },
    });
  });

  app.post('/registry/promote/:id', async (request, reply) => {
    if (!(await enforceRegistryInstallIncidentGuard(reply))) return;

    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{ review_reason?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    try {
      const current = await pool.query(
        `SELECT si.id, si.tool_id
         FROM skills_installed si
         WHERE si.id = $1 AND si.organization_id = $2
         LIMIT 1`,
        [id, orgId],
      );
      if (current.rows.length === 0) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Installed skill not found' },
        });
        return;
      }

      const trustedGate = await ensureTrustedPromotionPreconditions(pool, {
        organizationId: orgId,
        installedSkillId: id,
        reviewerId: String((request as any).userId || ''),
        reviewReason: String(body?.review_reason || ''),
      });
      if (!trustedGate.ok) {
        reply.status(trustedGate.status).send({
          success: false,
          error: { code: trustedGate.code, message: trustedGate.message },
        });
        return;
      }

      const updated = await pool.query(
        `UPDATE skills_installed
         SET trust_level = 'trusted'
         WHERE id = $1 AND organization_id = $2
         RETURNING id, trust_level`,
        [id, orgId],
      );

      await pool.query(
        `DELETE FROM skill_quarantine_reports WHERE skill_id = $1 AND organization_id = $2`,
        [id, orgId],
      );

      request.log.info(
        {
          skill_id: id,
          organization_id: orgId,
          reviewer_user_id: (request as any).userId || null,
          review_reason: String(body?.review_reason || '').trim(),
        },
        'registry trusted promotion approved',
      );

      reply.send({ success: true, data: updated.rows[0] });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'Registry schema not available in this environment' },
        });
        return;
      }
      throw err;
    }
  });

  app.post('/registry/installed', async (request, reply) => {
    if (!(await enforceRegistryInstallIncidentGuard(reply))) return;

    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{ catalog_entry_id?: string; tool_id?: string; trust_level?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.catalog_entry_id || !body.tool_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'catalog_entry_id and tool_id are required' } });
      return;
    }
    if (body.trust_level && !VALID_TRUST_LEVELS.includes(body.trust_level as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `trust_level must be one of: ${VALID_TRUST_LEVELS.join(', ')}` } });
      return;
    }

    const catalog = await pool.query(
      `SELECT id, name, manifest
       FROM skills_catalog
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [body.catalog_entry_id, orgId],
    );
    if (catalog.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Catalog entry not found' } });
      return;
    }

    const manifest = (catalog.rows[0].manifest || {}) as Record<string, unknown>;
    const mappedToolId = typeof manifest.tool_id === 'string' ? manifest.tool_id.trim() : '';
    if (!mappedToolId) {
      reply.status(422).send({
        success: false,
        error: {
          code: 'CATALOG_TOOL_MAPPING_REQUIRED',
          message: 'Catalog entry is missing manifest.tool_id mapping',
        },
      });
      return;
    }
    if (String(body.tool_id).trim() !== mappedToolId) {
      reply.status(422).send({
        success: false,
        error: {
          code: 'CATALOG_TOOL_MISMATCH',
          message: 'tool_id must match catalog manifest.tool_id mapping',
        },
      });
      return;
    }

    const toolExists = await pool.query('SELECT 1 FROM tools WHERE id = $1', [body.tool_id]);
    if (toolExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tool not found' } });
      return;
    }

    const id = uuidv7();
    if (body.trust_level && body.trust_level !== 'quarantined') {
      reply.status(403).send({
        success: false,
        error: {
          code: 'TRUST_PROMOTION_REQUIRED',
          message: 'Direct install always creates quarantined skills; use promote endpoint after review',
        },
      });
      return;
    }
    const trustLevel = 'quarantined';
    const inserted = await pool.query(
      `INSERT INTO skills_installed (id, organization_id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at`,
      [id, orgId, body.catalog_entry_id, body.tool_id, trustLevel, (request as any).userId],
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
            [orgId, body.catalog_entry_id, body.tool_id],
          )
        ).rows[0];
    if (!installRow) {
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL', message: 'Registry install could not be resolved after conflict handling' },
      });
      return;
    }
    const installId = String(installRow.id);

    if (insertedNew && trustLevel === 'quarantined') {
      if (!ensureQuarantineScanConfiguredOrReply(reply)) return;
      const reportId = uuidv7();
      const staticChecks = { status: 'pending', checks: [] };
      const { sbom, vulnScan } = buildQuarantineReportScanPayloads();
      await pool.query(
        `INSERT INTO skill_quarantine_reports (id, skill_id, organization_id, static_checks, sbom, vuln_scan, overall_risk, reviewed_by, reviewed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [reportId, installId, orgId, JSON.stringify(staticChecks), JSON.stringify(sbom), JSON.stringify(vulnScan), 'unknown', null, null],
      );
    }

    if (!insertedNew) {
      reply.send({
        success: true,
        data: { ...installRow, installed: false, exists: true },
      });
      return;
    }

    reply.status(201).send({
      success: true,
      data: {
        id: installId,
        catalog_entry_id: body.catalog_entry_id,
        tool_id: body.tool_id,
        trust_level: trustLevel,
        installed: true,
      },
    });
  });

  app.patch('/registry/installed/:id', async (request, reply) => {
    if (!(await enforceRegistryInstallIncidentGuard(reply))) return;

    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{ trust_level?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.trust_level || !VALID_TRUST_LEVELS.includes(body.trust_level as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `trust_level must be one of: ${VALID_TRUST_LEVELS.join(', ')}` } });
      return;
    }
    if (body.trust_level === 'trusted') {
      reply.status(403).send({
        success: false,
        error: {
          code: 'TRUST_PROMOTION_REQUIRED',
          message: 'Direct trust escalation is not allowed; use promote endpoint with review evidence',
        },
      });
      return;
    }

    const res = await pool.query(
      `UPDATE skills_installed SET trust_level = $1 WHERE id = $2 AND organization_id = $3 RETURNING id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at`,
      [body.trust_level, id, orgId],
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Installed skill not found' } });
      return;
    }

    if (body.trust_level === 'quarantined') {
      const existing = await pool.query(
        `SELECT 1 FROM skill_quarantine_reports WHERE skill_id = $1 AND organization_id = $2`,
        [id, orgId],
      );
      if (existing.rows.length === 0) {
        if (!ensureQuarantineScanConfiguredOrReply(reply)) return;
        const reportId = uuidv7();
        const staticChecks = { status: 'pending', checks: [] };
        const { sbom, vulnScan } = buildQuarantineReportScanPayloads();
        await pool.query(
          `INSERT INTO skill_quarantine_reports (id, skill_id, organization_id, static_checks, sbom, vuln_scan, overall_risk, reviewed_by, reviewed_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [reportId, id, orgId, JSON.stringify(staticChecks), JSON.stringify(sbom), JSON.stringify(vulnScan), 'unknown', null, null],
        );
      }
    } else {
      await pool.query(
        `DELETE FROM skill_quarantine_reports WHERE skill_id = $1 AND organization_id = $2`,
        [id, orgId],
      );
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/registry/installed/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      try {
        await client.query(
          'DELETE FROM skill_quarantine_reports WHERE skill_id = $1 AND organization_id = $2',
          [id, orgId],
        );
      } catch (err) {
        if (isSchemaCompatError(err)) {
          throw new RegistrySchemaUnavailableError('Registry schema not available in this environment');
        } else {
          throw err;
        }
      }

      try {
        await client.query(
          'DELETE FROM skill_signatures WHERE skill_id = $1 AND organization_id = $2',
          [id, orgId],
        );
      } catch (err) {
        if (isSchemaCompatError(err)) {
          throw new RegistrySchemaUnavailableError('Registry schema not available in this environment');
        } else {
          throw err;
        }
      }

      const res = await client.query(
        'DELETE FROM skills_installed WHERE id = $1 AND organization_id = $2 RETURNING id',
        [id, orgId],
      );
      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Installed skill not found' } });
        return;
      }

      await client.query('COMMIT');
      reply.send({ success: true });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // no-op: rollback may fail if transaction already closed
      }
      if (err instanceof RegistrySchemaUnavailableError) {
        reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: err.message },
        });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── Skill Signatures ───────────────────────────────────────────────────
  app.get('/registry/signatures', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as { skill_id?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.skill_id) {
      params.push(query.skill_id);
      where += ` AND skill_id = $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM skill_signatures ${where}`,
      params,
    );
    const total = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, skill_id, signature_type, signature, public_key, verified, verified_at, created_at
       FROM skill_signatures ${where}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  app.post('/registry/signatures', async (request, reply) => {
    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{
      skill_id?: string;
      signature_type?: string;
      signature?: string;
      public_key?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.skill_id || !body.signature || !body.public_key) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'skill_id, signature, and public_key are required' } });
      return;
    }

    const skillExists = await pool.query('SELECT 1 FROM skills_installed WHERE id = $1 AND organization_id = $2', [body.skill_id, orgId]);
    if (skillExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Installed skill not found' } });
      return;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO skill_signatures (id, organization_id, skill_id, signature_type, signature, public_key, verified, verified_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        orgId,
        body.skill_id,
        body.signature_type || 'cosign',
        body.signature,
        body.public_key,
        false,
        null,
      ],
    );

    reply.status(201).send({ success: true, data: { id } });
  });

  app.patch('/registry/signatures/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{ verified?: boolean }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (body.verified === undefined) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'verified is required' } });
      return;
    }
    if (body.verified) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: 'verified=true is not allowed via PATCH; use /registry/signatures/:id/verify',
        },
      });
      return;
    }

    const res = await pool.query(
      `UPDATE skill_signatures SET verified = $1, verified_at = $2 WHERE id = $3 AND organization_id = $4 RETURNING id, skill_id, signature_type, signature, public_key, verified, verified_at`,
      [false, null, id, orgId],
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Signature not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.post('/registry/signatures/:id/verify', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeRegistryBody<{ payload?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const payload = String(bodyParsed.value.payload || '');
    if (!payload) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'payload is required for verification' },
      });
      return;
    }

    const row = await pool.query(
      `SELECT id, signature_type, signature, public_key, verified, verified_at
       FROM skill_signatures
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1`,
      [id, orgId],
    );
    if (row.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Signature not found' } });
      return;
    }
    const signatureRow = row.rows[0] as {
      signature_type: string;
      signature: string;
      public_key: string;
    };
    const verification = verifyDetachedSignature({
      signatureType: signatureRow.signature_type,
      payload,
      signature: signatureRow.signature,
      publicKeyPem: signatureRow.public_key,
    });
    if (!verification.ok) {
      reply.status(400).send({
        success: false,
        error: { code: 'SIGNATURE_VERIFICATION_FAILED', message: verification.message },
      });
      return;
    }

    const verifiedAt = new Date();
    const updated = await pool.query(
      `UPDATE skill_signatures
       SET verified = true,
           verified_at = $3
       WHERE id = $1
         AND organization_id = $2
       RETURNING id, skill_id, signature_type, signature, public_key, verified, verified_at`,
      [id, orgId, verifiedAt],
    );
    reply.send({ success: true, data: updated.rows[0] });
  });

  app.delete('/registry/signatures/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM skill_signatures WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Signature not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Skill Quarantine Reports ───────────────────────────────────────────
  app.get('/registry/quarantine-reports', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as { skill_id?: string; page?: string; per_page?: string };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.skill_id) {
      params.push(query.skill_id);
      where += ` AND skill_id = $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM skill_quarantine_reports ${where}`,
      params,
    );
    const total = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT qr.id,
              qr.skill_id,
              qr.static_checks,
              qr.sbom,
              qr.vuln_scan,
              qr.overall_risk,
              qr.reviewed_by,
              qr.reviewed_at,
              qr.created_at,
              COALESCE(sc.name, t.name, si.tool_id, qr.skill_id) AS name,
              CASE
                WHEN qr.reviewed_at IS NOT NULL THEN CONCAT('Reviewed · risk ', qr.overall_risk)
                ELSE 'Awaiting review'
              END AS reason
         FROM skill_quarantine_reports qr
         LEFT JOIN skills_installed si
           ON si.id = qr.skill_id
          AND si.organization_id = qr.organization_id
         LEFT JOIN skills_catalog sc
           ON sc.id = si.catalog_entry_id
          AND sc.organization_id = qr.organization_id
         LEFT JOIN tools t
           ON t.id = si.tool_id
       ${where.replace('organization_id', 'qr.organization_id')}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  // Backward-compat alias expected by admin UI.
  app.get('/registry/quarantine', async (request, reply) => {
    const orgId = currentOrgId(request);
    try {
      const result = await pool.query(
        `SELECT qr.id,
                qr.skill_id,
                qr.static_checks,
                qr.sbom,
                qr.vuln_scan,
                qr.overall_risk,
                qr.reviewed_by,
                qr.reviewed_at,
                qr.created_at,
                COALESCE(sc.name, t.name, si.tool_id, qr.skill_id) AS name,
                CASE
                  WHEN qr.reviewed_at IS NOT NULL THEN CONCAT('Reviewed · risk ', qr.overall_risk)
                  ELSE 'Awaiting review'
                END AS reason
           FROM skill_quarantine_reports qr
           LEFT JOIN skills_installed si
             ON si.id = qr.skill_id
            AND si.organization_id = qr.organization_id
           LEFT JOIN skills_catalog sc
             ON sc.id = si.catalog_entry_id
            AND sc.organization_id = qr.organization_id
           LEFT JOIN tools t
             ON t.id = si.tool_id
          WHERE qr.organization_id = $1
          ORDER BY qr.created_at DESC
         LIMIT 200`,
        [orgId],
      );
      reply.send({ success: true, data: result.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendRegistrySchemaUnavailable(reply, 'quarantine');
        return;
      }
      throw err;
    }
  });

  app.post('/registry/quarantine-reports', async (request, reply) => {
    const orgId = currentOrgId(request);
    const bodyParsed = normalizeRegistryBody<{
      skill_id?: string;
      static_checks?: Record<string, unknown>;
      sbom?: Record<string, unknown> | null;
      vuln_scan?: Record<string, unknown> | null;
      overall_risk?: string;
      reviewed_by?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.skill_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'skill_id is required' } });
      return;
    }
    if (body.overall_risk && !VALID_RISK.includes(body.overall_risk as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `overall_risk must be one of: ${VALID_RISK.join(', ')}` } });
      return;
    }

    const skillExists = await pool.query('SELECT 1 FROM skills_installed WHERE id = $1 AND organization_id = $2', [body.skill_id, orgId]);
    if (skillExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Installed skill not found' } });
      return;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO skill_quarantine_reports (id, skill_id, organization_id, static_checks, sbom, vuln_scan, overall_risk, reviewed_by, reviewed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        id,
        body.skill_id,
        orgId,
        JSON.stringify(body.static_checks || {}),
        body.sbom ? JSON.stringify(body.sbom) : null,
        body.vuln_scan ? JSON.stringify(body.vuln_scan) : null,
        body.overall_risk || 'unknown',
        body.reviewed_by || (request as any).userId || null,
        body.reviewed_by ? new Date() : null,
      ],
    );

    reply.status(201).send({ success: true, data: { id } });
  });
}
