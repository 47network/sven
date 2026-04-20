import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { randomBytes } from 'node:crypto';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-invites');

const INVITE_TOKEN_BYTES = 32;
const MAX_INVITE_TTL_HOURS = 720; // 30 days
const DEFAULT_INVITE_TTL_HOURS = 72; // 3 days

function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

export async function registerInviteRoutes(app: FastifyInstance, pool: pg.Pool) {
  const validRoles = new Set(['admin', 'operator', 'user']);

  // ─── POST /invites ─── Create an invite token (admin/owner only)
  // lgtm[js/missing-rate-limiting] fastify rateLimit configuration
  app.post('/invites', { config: { rateLimit: { max: 100, timeWindow: 60000 } } }, async (request: any, reply) => {
    const orgId = String(request.orgId || '').trim();
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const isPlatformAdmin = String(request.userRole || '').trim() === 'platform_admin';
    const tenantRole = String(request.tenantRole || '').trim();
    if (!isPlatformAdmin && tenantRole !== 'owner' && tenantRole !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins and owners can create invites' },
      });
    }

    const body = (request.body || {}) as {
      role?: string;
      max_uses?: number;
      expires_in_hours?: number;
    };

    const role = validRoles.has(String(body.role || '')) ? String(body.role) : 'user';
    if ((role === 'admin' || role === 'operator') && !isPlatformAdmin && tenantRole !== 'owner') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Creating admin/operator invites requires owner or platform admin privileges' },
      });
    }

    const maxUses = Math.max(1, Math.min(1000, Number(body.max_uses) || 1));
    const ttlHours = Math.max(1, Math.min(MAX_INVITE_TTL_HOURS, Number(body.expires_in_hours) || DEFAULT_INVITE_TTL_HOURS));
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const id = uuidv7();
    const token = generateInviteToken();
    const userId = String(request.userId || '');

    await pool.query(
      `INSERT INTO invite_tokens (id, token, created_by, organization_id, role, max_uses, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [id, token, userId, orgId, role, maxUses, expiresAt.toISOString()],
    );

    logger.info('Invite token created', {
      invite_id: id,
      created_by: userId,
      organization_id: orgId,
      role,
      max_uses: maxUses,
      expires_at: expiresAt.toISOString(),
    });

    reply.status(201).send({
      success: true,
      data: {
        id,
        token,
        role,
        max_uses: maxUses,
        use_count: 0,
        organization_id: orgId,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      },
    });
  });

  // ─── GET /invites ─── List invites for current org
  // lgtm[js/missing-rate-limiting] fastify rateLimit configuration
  app.get('/invites', { config: { rateLimit: { max: 100, timeWindow: 60000 } } }, async (request: any, reply) => {
    const orgId = String(request.orgId || '').trim();
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const query = request.query as { include_expired?: string };
    const includeExpired = query.include_expired === 'true';

    let sql = `SELECT i.id, i.token, i.role, i.max_uses, i.use_count, i.organization_id,
                      i.expires_at, i.revoked_at, i.created_at, i.updated_at,
                      u.username AS created_by_username
               FROM invite_tokens i
               LEFT JOIN users u ON u.id = i.created_by
               WHERE i.organization_id = $1`;

    if (!includeExpired) {
      sql += ` AND i.revoked_at IS NULL AND i.expires_at > NOW() AND i.use_count < i.max_uses`;
    }

    sql += ` ORDER BY i.created_at DESC LIMIT 100`;

    const result = await pool.query(sql, [orgId]);
    reply.send({ success: true, data: result.rows });
  });

  // ─── GET /invites/:id ─── Get single invite details
  // lgtm[js/missing-rate-limiting] fastify rateLimit configuration
  app.get('/invites/:id', { config: { rateLimit: { max: 100, timeWindow: 60000 } } }, async (request: any, reply) => {
    const orgId = String(request.orgId || '').trim();
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT i.id, i.token, i.role, i.max_uses, i.use_count, i.organization_id,
              i.expires_at, i.revoked_at, i.created_at, i.updated_at,
              u.username AS created_by_username
       FROM invite_tokens i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE i.id = $1 AND i.organization_id = $2`,
      [id, orgId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invite not found' },
      });
    }

    const redemptions = await pool.query(
      `SELECT r.id, r.user_id, u.username, r.created_at
       FROM invite_redemptions r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.invite_id = $1
       ORDER BY r.created_at DESC`,
      [id],
    );

    reply.send({
      success: true,
      data: { ...result.rows[0], redemptions: redemptions.rows },
    });
  });

  // ─── DELETE /invites/:id ─── Revoke an invite
  // lgtm[js/missing-rate-limiting] fastify rateLimit configuration
  app.delete('/invites/:id', { config: { rateLimit: { max: 100, timeWindow: 60000 } } }, async (request: any, reply) => {
    const orgId = String(request.orgId || '').trim();
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const { id } = request.params as { id: string };
    const result = await pool.query(
      `UPDATE invite_tokens
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [id, orgId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invite not found or already revoked' },
      });
    }

    logger.info('Invite token revoked', { invite_id: id, organization_id: orgId });
    reply.send({ success: true });
  });
}
