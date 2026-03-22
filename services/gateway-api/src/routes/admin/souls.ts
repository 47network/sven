import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createHash, verify } from 'node:crypto';
import { isUuid } from '../../lib/input-validation.js';

export async function registerSoulsRoutes(app: FastifyInstance, pool: pg.Pool) {
  function requireActiveOrg(request: any, reply: any): string | null {
    const orgId = String(request.orgId || '').trim();
    if (orgId) return orgId;
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return null;
  }

  app.addHook('preHandler', async (request: any, reply) => {
    if (String(request.userRole || '') === 'platform_admin') return;
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
  });

  // ─── GET /souls/catalog ───
  app.get('/souls/catalog', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const query = request.query as { search?: string; limit?: string };
    const search = String(query.search || '').trim();
    const limitRaw = query.limit;
    const parsedLimit = limitRaw === undefined ? 200 : Number.parseInt(String(limitRaw), 10);
    if (!Number.isFinite(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 500' },
      });
      return;
    }
    const limit = Math.min(parsedLimit, 500);

    const params: unknown[] = [orgId];
    let sql = 'SELECT * FROM souls_catalog WHERE organization_id = $1';
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (slug ILIKE $${params.length} OR name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    try {
      const result = await pool.query(sql, params);
      reply.send({ success: true, data: { rows: result.rows } });
    } catch (err) {
      if (isMissingRelation(err)) {
        reply.status(503).send({
          success: false,
          error: { code: 'SCHEMA_MISSING_RELATION', message: 'SOULS schema is not available' },
        });
        return;
      }
      throw err;
    }
  });

  // ─── POST /souls/catalog ───
  app.post('/souls/catalog', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const body = (request.body || {}) as {
      slug?: string;
      name?: string;
      description?: string;
      version?: string;
      author?: string;
      tags?: string[];
      source?: string;
      content?: string;
      checksum?: string;
    };

    const slug = String(body.slug || '').trim();
    const name = String(body.name || '').trim();
    const content = String(body.content || '').trim();
    if (!slug || !name || !content) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'slug, name, and content are required' },
      });
      return;
    }

    const id = uuidv7();
    const description = String(body.description || '');
    const version = String(body.version || '0.1.0');
    const author = body.author ? String(body.author) : null;
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : [];
    const source = String(body.source || 'local');
    const checksum = body.checksum ? String(body.checksum) : null;

    try {
      await pool.query(
        `INSERT INTO souls_catalog (id, organization_id, slug, name, description, version, author, tags, source, content, checksum, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [id, orgId, slug, name, description, version, author, tags, source, content, checksum],
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        reply.status(409).send({
          success: false,
          error: { code: 'SOUL_VERSION_CONFLICT', message: 'Soul slug+version already exists' },
        });
        return;
      }
      throw err;
    }

    reply.status(201).send({ success: true, data: { id } });
  });

  // ─── PATCH /souls/catalog/:id ───
  app.patch('/souls/catalog/:id', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];

    const setField = (key: string, value: unknown) => {
      values.push(value);
      fields.push(`${key} = $${values.length}`);
    };

    if (body.slug !== undefined) setField('slug', String(body.slug));
    if (body.name !== undefined) setField('name', String(body.name));
    if (body.description !== undefined) setField('description', String(body.description));
    if (body.version !== undefined) setField('version', String(body.version));
    if (body.author !== undefined) setField('author', body.author ? String(body.author) : null);
    if (body.tags !== undefined) {
      const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : [];
      setField('tags', tags);
    }
    if (body.source !== undefined) setField('source', String(body.source));
    if (body.content !== undefined) setField('content', String(body.content));
    if (body.checksum !== undefined) setField('checksum', body.checksum ? String(body.checksum) : null);

    if (fields.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    values.push(id);
    values.push(orgId);
    const sql = `UPDATE souls_catalog SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING id`;
    const updated = await pool.query(sql, values);
    if (updated.rowCount === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Soul catalog entry not found' },
      });
      return;
    }
    reply.send({ success: true, data: { id: String(updated.rows[0]?.id || id) } });
  });

  // ─── DELETE /souls/catalog/:id ───
  app.delete('/souls/catalog/:id', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const deleted = await pool.query('DELETE FROM souls_catalog WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (deleted.rowCount === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Soul catalog entry not found' },
      });
      return;
    }
    reply.send({ success: true, data: { id: String(deleted.rows[0]?.id || id) } });
  });

  // ─── GET /souls/installed ───
  app.get('/souls/installed', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    try {
      const result = await pool.query(
        `SELECT si.*, sc.name, sc.description, sc.author
         FROM souls_installed si
         JOIN souls_catalog sc ON sc.id = si.soul_id
         WHERE si.organization_id = $1
           AND sc.organization_id = $1
         ORDER BY si.installed_at DESC`,
        [orgId],
      );
      reply.send({ success: true, data: { rows: result.rows } });
    } catch (err) {
      if (isMissingRelation(err)) {
        reply.status(503).send({
          success: false,
          error: { code: 'SCHEMA_MISSING_RELATION', message: 'SOULS schema is not available' },
        });
        return;
      }
      throw err;
    }
  });

  // ─── POST /souls/install ───
  app.post('/souls/install', async (request: any, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const body = (request.body || {}) as { id?: string; slug?: string; activate?: unknown };
    if (body.activate !== undefined && typeof body.activate !== 'boolean') {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'activate must be boolean' },
      });
      return;
    }
    const shouldActivate = body.activate === true;
    let soulRow: any | null = null;
    if (body.id) {
      const res = await pool.query(`SELECT * FROM souls_catalog WHERE id = $1 AND organization_id = $2`, [String(body.id), orgId]);
      soulRow = res.rows[0] || null;
    } else if (body.slug) {
      const res = await pool.query(
        `SELECT * FROM souls_catalog WHERE slug = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [String(body.slug), orgId],
      );
      soulRow = res.rows[0] || null;
    }

    if (!soulRow) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Soul not found' } });
      return;
    }

    const trustPolicy = await getTrustPolicy(pool, orgId);
    if (trustPolicy.require_signature) {
      const sigRes = await pool.query(
        `SELECT verified, trusted
         FROM souls_signatures
         WHERE organization_id = $1
           AND soul_id = $2
           AND verified = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [orgId, soulRow.id],
      );
      const sig = sigRes.rows[0];
      const trustedByPolicy = await isSignatureTrusted(pool, orgId, soulRow.id, trustPolicy.trusted_fingerprints);
      if (!sig || (!sig.trusted && !trustedByPolicy)) {
        reply.status(412).send({
          success: false,
          error: { code: 'SIGNATURE_REQUIRED', message: 'Soul signature required by policy' },
        });
        return;
      }
    }

    const installId = uuidv7();
    const requestedStatus = shouldActivate ? 'active' : 'installed';
    const requestedActivatedAt = shouldActivate ? new Date().toISOString() : null;
    const upsertRes = await pool.query(
      `INSERT INTO souls_installed (id, organization_id, soul_id, slug, version, status, installed_by, installed_at, activated_at, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
       ON CONFLICT (organization_id, soul_id) DO UPDATE SET
         slug = EXCLUDED.slug,
         version = EXCLUDED.version,
         content = EXCLUDED.content,
         installed_by = COALESCE(EXCLUDED.installed_by, souls_installed.installed_by),
         status = CASE
           WHEN EXCLUDED.status = 'active' THEN 'active'
           ELSE souls_installed.status
         END,
         activated_at = CASE
           WHEN EXCLUDED.status = 'active' THEN COALESCE(EXCLUDED.activated_at, NOW())
           ELSE souls_installed.activated_at
         END
       RETURNING id, status`,
      [
        installId,
        orgId,
        soulRow.id,
        soulRow.slug,
        soulRow.version,
        requestedStatus,
        request.userId || null,
        requestedActivatedAt,
        soulRow.content,
      ],
    );
    const installedRow = upsertRes.rows[0];
    const persistedInstallId = installedRow?.id || installId;
    const status = String(installedRow?.status || requestedStatus);

    if (shouldActivate) {
      await activateSoul(pool, orgId, persistedInstallId, request.userId || null);
    }

    reply.send({ success: true, data: { id: persistedInstallId, status } });
  });

  // ─── POST /souls/activate/:id ───
  app.post('/souls/activate/:id', async (request: any, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const ok = await activateSoul(pool, orgId, id, request.userId || null);
    if (!ok) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Installed soul not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── GET /souls/signatures ───
  app.get('/souls/signatures', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const query = request.query as { soul_id?: string; limit?: string; offset?: string };
    if (query.soul_id && !isUuid(String(query.soul_id))) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'soul_id must be a UUID' },
      });
      return;
    }
    const limitRaw = query.limit;
    const offsetRaw = query.offset;
    const parsedLimit = limitRaw === undefined ? 50 : Number.parseInt(String(limitRaw), 10);
    const parsedOffset = offsetRaw === undefined ? 0 : Number.parseInt(String(offsetRaw), 10);
    if (!Number.isFinite(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 200' },
      });
      return;
    }
    if (!Number.isFinite(parsedOffset) || !Number.isInteger(parsedOffset) || parsedOffset < 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'offset must be an integer >= 0' },
      });
      return;
    }
    const limit = Math.min(parsedLimit, 200);
    const offset = parsedOffset;

    const params: unknown[] = [orgId];
    let sql = 'SELECT * FROM souls_signatures WHERE organization_id = $1';
    let countSql = 'SELECT COUNT(*)::int AS total FROM souls_signatures WHERE organization_id = $1';
    if (query.soul_id) {
      params.push(query.soul_id);
      sql += ` AND soul_id = $${params.length}`;
      countSql += ` AND soul_id = $${params.length}`;
    }
    const countParams = [...params];
    params.push(limit);
    params.push(offset);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    try {
      const [result, countResult] = await Promise.all([
        pool.query(sql, params),
        pool.query(countSql, countParams),
      ]);
      const total = Number(countResult.rows[0]?.total || 0);
      reply.send({
        success: true,
        data: {
          rows: result.rows,
          pagination: {
            total,
            limit,
            offset,
          },
        },
      });
    } catch (err) {
      if (isMissingRelation(err)) {
        reply.status(503).send({
          success: false,
          error: { code: 'SCHEMA_MISSING_RELATION', message: 'SOULS schema is not available' },
        });
        return;
      }
      throw err;
    }
  });

  // ─── POST /souls/signatures ───
  app.post('/souls/signatures', async (request, reply) => {
    const orgId = requireActiveOrg(request as any, reply);
    if (!orgId) return;
    const body = (request.body || {}) as {
      soul_id?: string;
      slug?: string;
      signature_type?: string;
      signature?: string;
      public_key?: string;
    };

    const signature = String(body.signature || '').trim();
    const publicKey = String(body.public_key || '').trim();
    if (!signature || !publicKey) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'signature and public_key are required' },
      });
      return;
    }

    let soulRow: any | null = null;
    if (body.soul_id) {
      if (!isUuid(String(body.soul_id))) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'soul_id must be a UUID' },
        });
        return;
      }
      const res = await pool.query(`SELECT * FROM souls_catalog WHERE id = $1 AND organization_id = $2`, [String(body.soul_id), orgId]);
      soulRow = res.rows[0] || null;
    } else if (body.slug) {
      const res = await pool.query(
        `SELECT * FROM souls_catalog WHERE slug = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [String(body.slug), orgId],
      );
      soulRow = res.rows[0] || null;
    }
    if (!soulRow) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Soul not found' } });
      return;
    }

    const signatureType = String(body.signature_type || 'ed25519');
    const payload = Buffer.from(String(soulRow.content || ''), 'utf8');
    const verified = verifySignature(signatureType, payload, signature, publicKey);
    const fingerprint = fingerprintKey(publicKey);
    const trustPolicy = await getTrustPolicy(pool, orgId);
    const trusted = trustPolicy.trusted_fingerprints.includes(fingerprint);

    const id = uuidv7();
    await pool.query(
      `INSERT INTO souls_signatures (id, organization_id, soul_id, signature_type, signature, public_key, fingerprint, verified, trusted, verified_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id,
        orgId,
        soulRow.id,
        signatureType,
        signature,
        publicKey,
        fingerprint,
        verified,
        trusted,
        verified ? new Date().toISOString() : null,
      ],
    );

    reply.status(201).send({ success: true, data: { id, verified, trusted, fingerprint } });
  });
}

async function activateSoul(pool: pg.Pool, orgId: string, installedId: string, userId: string | null): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `SELECT si.id, si.content
       FROM souls_installed si
       WHERE si.id = $1
         AND si.organization_id = $2
       FOR UPDATE`,
      [installedId, orgId],
    );
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const content = String(res.rows[0].content || '');

    await client.query(`UPDATE souls_installed SET status = 'installed' WHERE status = 'active' AND organization_id = $1`, [orgId]);
    await client.query(
      `UPDATE souls_installed SET status = 'active', activated_at = NOW() WHERE id = $1`,
      [installedId],
    );

    await client.query(
      `INSERT INTO sven_identity_docs (id, organization_id, scope, content, version, updated_by, updated_at)
       VALUES ($1, $2, 'global', $3, 1, $4, NOW())
       ON CONFLICT (organization_id, scope) WHERE scope = 'global'
       DO UPDATE SET content = $3, updated_by = $4, updated_at = NOW(), version = sven_identity_docs.version + 1`,
      [uuidv7(), orgId, content, userId],
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function fingerprintKey(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('hex');
}

function verifySignature(
  signatureType: string,
  payload: Buffer,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const sig = Buffer.from(signature, 'base64');
    if (signatureType === 'ed25519') {
      return verify(null, payload, publicKey, sig);
    }
    if (signatureType === 'rsa-sha256') {
      return verify('RSA-SHA256', payload, publicKey, sig);
    }
    if (signatureType === 'ecdsa-sha256') {
      return verify('SHA256', payload, publicKey, sig);
    }
    return false;
  } catch {
    return false;
  }
}

async function getTrustPolicy(pool: pg.Pool, orgId: string): Promise<{
  require_signature: boolean;
  trusted_fingerprints: string[];
}> {
  const orgRes = await pool.query(
    `SELECT key, value FROM organization_settings WHERE organization_id = $1 AND key IN ('souls.require_signature', 'souls.trusted_key_fingerprints')`,
    [orgId],
  );
  const globalRes = await pool.query(
    `SELECT key, value FROM settings_global WHERE key IN ('souls.require_signature', 'souls.trusted_key_fingerprints')`,
  );
  const rows = orgRes.rows.length > 0 ? orgRes.rows : globalRes.rows;
  let requireSignature = false;
  let fingerprints: string[] = [];
  for (const row of rows) {
    if (row.key === 'souls.require_signature') {
      requireSignature = Boolean(row.value === true || row.value === 'true' || row.value === 1);
    }
    if (row.key === 'souls.trusted_key_fingerprints') {
      if (Array.isArray(row.value)) {
        fingerprints = row.value.map((v: any) => String(v));
      } else if (typeof row.value === 'string') {
        try {
          const parsed = JSON.parse(row.value);
          if (Array.isArray(parsed)) fingerprints = parsed.map((v: unknown) => String(v));
        } catch {
          fingerprints = row.value.split(',').map((v: string) => v.trim()).filter(Boolean);
        }
      }
    }
  }
  return { require_signature: requireSignature, trusted_fingerprints: fingerprints };
}

async function isSignatureTrusted(
  pool: pg.Pool,
  orgId: string,
  soulId: string,
  trustedFingerprints: string[],
): Promise<boolean> {
  if (trustedFingerprints.length === 0) return false;
  const res = await pool.query(
    `SELECT 1 FROM souls_signatures WHERE organization_id = $1 AND soul_id = $2 AND fingerprint = ANY($3::text[]) AND verified = true LIMIT 1`,
    [orgId, soulId, trustedFingerprints],
  );
  return res.rows.length > 0;
}

function isMissingRelation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as { code?: string }).code === '42P01';
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as { code?: string }).code === '23505';
}
