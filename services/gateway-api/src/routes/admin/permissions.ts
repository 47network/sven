import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';

const logger = createLogger('admin-permissions');

const VALID_EFFECTS = ['allow', 'deny'] as const;
const VALID_TARGET_TYPES = ['user', 'chat', 'global'] as const;

function normalizePermissionBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

export async function registerPermissionRoutes(app: FastifyInstance, pool: pg.Pool) {
  function requireOrgId(request: any, reply: any): string | null {
    const orgId = request.orgId ? String(request.orgId) : null;
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return null;
    }
    return orgId;
  }

  // ─── GET /permissions ───
  app.get('/permissions', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const query = request.query as { target_type?: string; target_id?: string; scope?: string; page?: string; per_page?: string };
    const pagination = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 50, maxPerPage: 200 });
    if (!pagination.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: pagination.message },
      });
    }
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];

    if (query.target_type) { params.push(query.target_type); where += ` AND target_type = $${params.length}`; }
    if (query.target_id) { params.push(query.target_id); where += ` AND target_id = $${params.length}`; }
    if (query.scope) { params.push(query.scope); where += ` AND scope = $${params.length}`; }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM permissions ${where}`, params);
    const total: number = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, scope, effect, target_type, target_id, conditions, created_by, created_at
       FROM permissions ${where}
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

  // ─── POST /permissions (grant) ───
  app.post('/permissions', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const bodyParsed = normalizePermissionBody<{
      scope?: string;
      effect?: string;
      target_type?: string;
      target_id?: string;
      conditions?: Record<string, unknown>;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    // Validate required fields
    if (!body.scope || typeof body.scope !== 'string' || body.scope.trim().length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'scope is required' } });
      return;
    }
    if (!body.effect || !VALID_EFFECTS.includes(body.effect as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `effect must be one of: ${VALID_EFFECTS.join(', ')}` } });
      return;
    }
    if (!body.target_type || !VALID_TARGET_TYPES.includes(body.target_type as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `target_type must be one of: ${VALID_TARGET_TYPES.join(', ')}` } });
      return;
    }

    // If target_type is user or chat, target_id is required and must belong to active org
    if (body.target_type !== 'global') {
      if (!body.target_id) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target_id is required for user/chat scoped permissions' } });
        return;
      }
      let exists;
      if (body.target_type === 'user') {
        exists = await pool.query(
          `SELECT 1
           FROM organization_memberships
           WHERE organization_id = $1
             AND user_id = $2
             AND status = 'active'
           LIMIT 1`,
          [orgId, body.target_id],
        );
      } else {
        exists = await pool.query(
          `SELECT 1
           FROM chats
           WHERE id = $1
             AND organization_id = $2
           LIMIT 1`,
          [body.target_id, orgId],
        );
      }
      if (exists.rows.length === 0) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `${body.target_type} target_id must belong to active organization` } });
        return;
      }
    } else if (body.target_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target_id is not allowed for global target_type' } });
      return;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO permissions (id, organization_id, scope, effect, target_type, target_id, conditions, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [id, orgId, body.scope.trim(), body.effect, body.target_type, body.target_id || null, JSON.stringify(body.conditions || null), (request as any).userId],
    );

    logger.info('Permission granted', { id, organization_id: orgId, scope: body.scope, effect: body.effect, target_type: body.target_type });
    reply.status(201).send({ success: true, data: { id, scope: body.scope, effect: body.effect, target_type: body.target_type, target_id: body.target_id || null } });
  });

  // ─── DELETE /permissions/:id (revoke) ───
  app.delete('/permissions/:id', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM permissions WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Permission not found' } });
      return;
    }
    logger.info('Permission revoked', { id });
    reply.send({ success: true });
  });
}
