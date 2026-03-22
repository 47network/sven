import { FastifyInstance } from 'fastify';
import pg from 'pg';

const ALLOWLIST_TYPES = ['nas_path', 'web_domain', 'ha_entity', 'ha_service', 'git_repo'] as const;

type AllowlistType = (typeof ALLOWLIST_TYPES)[number];

function isAllowlistType(value: string): value is AllowlistType {
  return (ALLOWLIST_TYPES as readonly string[]).includes(value);
}

function parseOptionalBooleanQuery(raw: unknown): { ok: true; value: boolean | null } | { ok: false } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false };
  }
  if (raw === 'true') {
    return { ok: true, value: true };
  }
  if (raw === 'false') {
    return { ok: true, value: false };
  }
  return { ok: false };
}

export async function registerAllowlistRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  function isPlatformAdmin(request: any): boolean {
    const role = String(request.userRole || '').trim();
    return role === 'platform_admin' || role === 'admin';
  }

  // ─── GET /allowlists ───
  app.get('/allowlists', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    const { type, enabled } = request.query as { type?: string; enabled?: string };

    if (type && !isAllowlistType(type)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: `Invalid allowlist type: ${type}` },
      });
      return;
    }

    const enabledFilter = parseOptionalBooleanQuery(enabled);
    if (!enabledFilter.ok) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled query must be true or false when provided' },
      });
      return;
    }
    const enabledValue = enabledFilter.value;

    const result = await pool.query(
      `SELECT id, type, pattern, description, danger_tier, enabled, created_by, created_at
       FROM allowlists
       WHERE organization_id = $1
         AND ($2::text IS NULL OR type = $2)
         AND ($3::boolean IS NULL OR enabled = $3)
       ORDER BY created_at DESC`,
      [orgId, type ?? null, enabledValue],
    );

    reply.send({ success: true, data: result.rows });
  });

  // ─── GET /allowlists/orphans ───
  app.get('/allowlists/orphans', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only platform admin can access orphan allowlist recovery' },
      });
      return;
    }

    const { type, limit } = request.query as { type?: string; limit?: string };
    if (type && !isAllowlistType(type)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: `Invalid allowlist type: ${type}` },
      });
      return;
    }
    const parsedLimit = Number.parseInt(String(limit || '100'), 10);
    const rowLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 1000) : 100;

    const rows = await pool.query(
      `SELECT id, type, pattern, description, danger_tier, enabled, created_by, created_at
       FROM allowlists
       WHERE organization_id IS NULL
         AND ($1::text IS NULL OR type = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [type ?? null, rowLimit],
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM allowlists
       WHERE organization_id IS NULL
         AND ($1::text IS NULL OR type = $1)`,
      [type ?? null],
    );

    reply.send({
      success: true,
      data: {
        total: Number(countRes.rows[0]?.total || 0),
        rows: rows.rows,
      },
    });
  });

  // ─── POST /allowlists/orphans/adopt-current-org ───
  app.post('/allowlists/orphans/adopt-current-org', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only platform admin can adopt orphan allowlist rows' },
      });
      return;
    }

    const body = (request.body || {}) as { type?: string; confirm?: boolean };
    const type = typeof body.type === 'string' ? body.type : undefined;
    if (type && !isAllowlistType(type)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: `Invalid allowlist type: ${type}` },
      });
      return;
    }
    if (body.confirm !== true) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'confirm=true is required to adopt orphan rows' },
      });
      return;
    }

    const updated = await pool.query(
      `UPDATE allowlists
       SET organization_id = $1
       WHERE organization_id IS NULL
         AND ($2::text IS NULL OR type = $2)
       RETURNING id`,
      [orgId, type ?? null],
    );

    reply.send({
      success: true,
      data: {
        adopted: updated.rows.length,
        adopted_by_org: orgId,
        adopted_by_user: String((request as any).userId || ''),
        adopted_at: new Date().toISOString(),
      },
    });
  });

  // ─── POST /allowlists ───
  app.post('/allowlists', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    const body = request.body as {
      type?: string;
      pattern?: string;
      description?: string;
      danger_tier?: number | null;
      enabled?: boolean;
    } | null;

    if (!body?.type || !isAllowlistType(body.type)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'type is required and must be valid' },
      });
      return;
    }

    if (!body.pattern || !body.pattern.trim()) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'pattern is required' },
      });
      return;
    }

    if (body.danger_tier !== undefined && body.danger_tier !== null) {
      if (![1, 2, 3].includes(body.danger_tier)) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'danger_tier must be 1, 2, or 3' },
        });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO allowlists (id, organization_id, type, pattern, description, danger_tier, enabled, created_by, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, type, pattern, description, danger_tier, enabled, created_by, created_at`,
      [
        orgId,
        body.type,
        body.pattern.trim(),
        body.description?.trim() ?? '',
        body.danger_tier ?? null,
        body.enabled ?? true,
        (request as any).userId,
      ],
    );

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── PUT /allowlists/:id ───
  app.put('/allowlists/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      pattern?: string;
      description?: string;
      danger_tier?: number | null;
      enabled?: boolean;
    } | null;

    if (!id) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'id is required' },
      });
      return;
    }

    const bodyRecord = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const hasDangerTierField = Object.prototype.hasOwnProperty.call(bodyRecord, 'danger_tier');
    const dangerTierRaw = hasDangerTierField ? (bodyRecord.danger_tier as number | null) : null;

    if (hasDangerTierField && dangerTierRaw !== null) {
      if (typeof dangerTierRaw !== 'number' || ![1, 2, 3].includes(dangerTierRaw)) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'danger_tier must be 1, 2, or 3' },
        });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE allowlists
       SET pattern = COALESCE($2, pattern),
           description = COALESCE($3, description),
           danger_tier = CASE WHEN $4::boolean THEN $5::int ELSE danger_tier END,
           enabled = COALESCE($6, enabled)
       WHERE id = $1 AND organization_id = $7
       RETURNING id, type, pattern, description, danger_tier, enabled, created_by, created_at`,
      [
        id,
        body?.pattern?.trim() ?? null,
        body?.description?.trim() ?? null,
        hasDangerTierField,
        hasDangerTierField ? dangerTierRaw : null,
        body?.enabled ?? null,
        orgId,
      ],
    );

    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Allowlist entry not found' },
      });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── DELETE /allowlists/:id ───
  app.delete('/allowlists/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    const { id } = request.params as { id: string };

    const result = await pool.query(
      `DELETE FROM allowlists WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId],
    );

    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Allowlist entry not found' },
      });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });
}
