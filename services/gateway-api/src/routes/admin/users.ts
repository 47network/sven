import { FastifyInstance } from 'fastify';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { randomInt } from 'node:crypto';
import { parsePaginationQuery } from './pagination.js';

const logger = createLogger('admin-users');
const IDENTITY_LINK_VERIFY_MAX_ATTEMPTS = 5;
const IDENTITY_LINK_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const identityLinkVerifyAttempts = new Map<string, { count: number; windowStartMs: number }>();

function normalizeUserBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

export async function registerUserRoutes(app: FastifyInstance, pool: pg.Pool) {
  const validRoles = new Set(['admin', 'operator', 'user']);

  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  async function ensureUserInOrg(userId: string, orgId: string): Promise<boolean> {
    const membership = await pool.query(
      `SELECT 1 FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [orgId, userId],
    );
    return membership.rows.length > 0;
  }

  function generateVerificationCode(): string {
    return String(randomInt(100000, 1000000));
  }

  function consumeIdentityLinkVerifyAttempt(scopeKey: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const now = Date.now();
    const current = identityLinkVerifyAttempts.get(scopeKey);
    if (!current || now - current.windowStartMs >= IDENTITY_LINK_VERIFY_WINDOW_MS) {
      identityLinkVerifyAttempts.set(scopeKey, { count: 1, windowStartMs: now });
      return { allowed: true };
    }
    if (current.count >= IDENTITY_LINK_VERIFY_MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((IDENTITY_LINK_VERIFY_WINDOW_MS - (now - current.windowStartMs)) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    current.count += 1;
    identityLinkVerifyAttempts.set(scopeKey, current);
    return { allowed: true };
  }

  function resetIdentityLinkVerifyAttempts(scopeKey: string): void {
    identityLinkVerifyAttempts.delete(scopeKey);
  }

  async function getLinkVerificationTtlSeconds(): Promise<number> {
    try {
      const res = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'identity.link_verification_ttl_seconds' LIMIT 1`,
      );
      if (res.rows.length === 0) return 600;
      const raw = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return 600;
      return Math.max(30, Math.min(3600, Math.floor(n)));
    } catch {
      return 600;
    }
  }

  // ─── GET /users ───
  app.get('/users', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const query = request.query as { page?: string; per_page?: string; role?: string };
    const pagination = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage: 100 });
    if (!pagination.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: pagination.message },
      });
    }
    const { page, perPage, offset } = pagination;

    let where = 'WHERE m.organization_id = $1 AND m.status = \'active\'';
    const params: unknown[] = [orgId];
    if (query.role) {
      params.push(query.role);
      where += ` AND u.role = $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users u
       JOIN organization_memberships m ON m.user_id = u.id
       ${where}`,
      params,
    );
    const total: number = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.role, u.created_at, u.updated_at
       FROM users u
       JOIN organization_memberships m ON m.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  // ─── GET /users/:id ───
  app.get('/users/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };
    if (!(await ensureUserInOrg(id, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const result = await pool.query(
      `SELECT id, username, display_name, role, created_at, updated_at FROM users WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const identities = await pool.query(
      `SELECT id, channel, channel_user_id, display_name, linked_at
       FROM identities WHERE user_id = $1 ORDER BY linked_at`,
      [id],
    );

    const identityLinks = await pool.query(
      `SELECT id, user_id, channel_type, channel_user_id, verified, linked_at, verified_at, verification_expires_at
       FROM identity_links
       WHERE user_id = $1
       ORDER BY linked_at DESC`,
      [id],
    );

    reply.send({
      success: true,
      data: { ...result.rows[0], identities: identities.rows, identity_links: identityLinks.rows },
    });
  });

  // ─── POST /users ───
  app.post('/users', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const isPlatformAdmin = String((request as any).userRole || '').trim() === 'platform_admin';
    const bodyParsed = normalizeUserBody<{
      username?: string;
      display_name?: string;
      role?: string;
      password?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.username || !body.password) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'username and password are required' },
      });
      return;
    }

    if (body.username.length < 2 || body.username.length > 64) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'username must be 2-64 characters' },
      });
      return;
    }

    if (body.password.length < 8) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'password must be at least 8 characters' },
      });
      return;
    }
    if (body.password.length > 128) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'password must be at most 128 characters' },
      });
      return;
    }

    // Check duplicate
    const dup = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [body.username]);
    if (dup.rows.length > 0) {
      reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Username already exists' },
      });
      return;
    }

    const id = uuidv7();
    const role = validRoles.has(String(body.role || '')) ? String(body.role) : 'user';
    if ((role === 'admin' || role === 'operator') && !isPlatformAdmin) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Creating admin or operator users requires platform admin privileges' },
      });
      return;
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const displayName = body.display_name || body.username;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (id, username, display_name, role, password_hash, active_organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [id, body.username, displayName, role, passwordHash, orgId],
      );
      await client.query(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())`,
        [uuidv7(), orgId, id, role === 'admin' ? 'admin' : 'member'],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info('User created', { user_id: id, username: body.username, role });
    reply.status(201).send({
      success: true,
      data: { id, username: body.username, display_name: displayName, role },
    });
  });

  const handleUpdateUser = async (request: any, reply: any) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const isPlatformAdmin = String((request as any).userRole || '').trim() === 'platform_admin';
    const { id } = request.params as { id: string };
    if (!(await ensureUserInOrg(id, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const bodyParsed = normalizeUserBody<{ display_name?: string; role?: string; password?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];
    let passwordChanged = false;

    if (body.display_name !== undefined) {
      const dn = String(body.display_name).slice(0, 256);
      params.push(dn);
      sets.push(`display_name = $${params.length}`);
    }
    if (body.role !== undefined) {
      if (!isPlatformAdmin) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Global role changes require platform admin privileges' },
        });
        return;
      }
      if (!validRoles.has(body.role)) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'role must be admin, operator, or user' },
        });
        return;
      }
      // Prevent demoting the last admin
      if (body.role !== 'admin') {
        const target = await pool.query(`SELECT role FROM users WHERE id = $1`, [id]);
        if (target.rows[0]?.role === 'admin') {
          const cnt = await pool.query(
            `SELECT COUNT(*)::int AS c
             FROM users u
             JOIN organization_memberships m ON m.user_id = u.id
             WHERE m.organization_id = $1 AND m.status = 'active' AND u.role = 'admin'`,
            [orgId],
          );
          if (cnt.rows[0].c <= 1) {
            reply.status(400).send({
              success: false,
              error: { code: 'LAST_ADMIN', message: 'Cannot demote the last admin' },
            });
            return;
          }
        }
      }
      params.push(body.role);
      sets.push(`role = $${params.length}`);
    }
    if (body.password !== undefined) {
      if (body.password.length < 8) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'password must be at least 8 characters' },
        });
        return;
      }
      if (body.password.length > 128) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'password must be at most 128 characters' },
        });
        return;
      }
      const hash = await bcrypt.hash(body.password, 12);
      params.push(hash);
      sets.push(`password_hash = $${params.length}`);
      passwordChanged = true;
    }

    if (sets.length === 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'No fields to update' },
      });
      return;
    }

    params.push(id);
    const res = await pool.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, username, display_name, role, updated_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    if (passwordChanged) {
      await pool.query(
        `UPDATE sessions
         SET status = 'revoked'
         WHERE user_id = $1 AND status IN ('active', 'pending_totp')`,
        [id],
      );
    }

    logger.info('User updated', { user_id: id });
    reply.send({ success: true, data: res.rows[0] });
  };

  // ─── PATCH /users/:id ───
  app.patch('/users/:id', handleUpdateUser);

  // Keep PUT as alias for backward compat, using identical validation/guards.
  app.put('/users/:id', handleUpdateUser);

  // ─── DELETE /users/:id ───
  app.delete('/users/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const isPlatformAdmin = String((request as any).userRole || '').trim() === 'platform_admin';
    const { id } = request.params as { id: string };
    if (!(await ensureUserInOrg(id, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // Prevent deleting last admin
    const target = await pool.query(`SELECT role FROM users WHERE id = $1`, [id]);
    if (target.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }
    if (target.rows[0].role === 'admin') {
      const cnt = await pool.query(
        `SELECT COUNT(*)::int AS c
         FROM users u
         JOIN organization_memberships m ON m.user_id = u.id
         WHERE m.organization_id = $1 AND m.status = 'active' AND u.role = 'admin'`,
        [orgId],
      );
      if (cnt.rows[0].c <= 1) {
        reply.status(400).send({
          success: false,
          error: { code: 'LAST_ADMIN', message: 'Cannot delete the last admin user' },
        });
        return;
      }
    }

    if (isPlatformAdmin) {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      logger.info('User globally deleted by platform admin', { user_id: id, organization_id: orgId });
      reply.send({ success: true, data: { deletion_scope: 'global_user' } });
      return;
    }

    const membershipDelete = await pool.query(
      `DELETE FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
       RETURNING id`,
      [orgId, id],
    );
    if (membershipDelete.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User membership not found' } });
    }
    logger.info('User membership removed', { user_id: id, organization_id: orgId });
    reply.send({ success: true, data: { deletion_scope: 'organization_membership' } });
    return;
  });

  // ─── POST /users/:id/identities ─── (link identity)
  app.post('/users/:id/identities', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: userId } = request.params as { id: string };
    if (!(await ensureUserInOrg(userId, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const bodyParsed = normalizeUserBody<{
      channel?: string;
      channel_user_id?: string;
      display_name?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.channel || !body.channel_user_id) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel and channel_user_id are required' },
      });
      return;
    }

    // Verify user exists
    const userCheck = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [userId]);
    if (userCheck.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const identityId = uuidv7();
    try {
      await pool.query(
        `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [identityId, userId, body.channel, body.channel_user_id, body.display_name || null],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'This channel identity is already linked' },
        });
        return;
      }
      throw err;
    }

    logger.info('Identity linked', { user_id: userId, channel: body.channel });
    reply.status(201).send({
      success: true,
      data: { id: identityId, user_id: userId, channel: body.channel, channel_user_id: body.channel_user_id },
    });
  });

  // ─── DELETE /users/:userId/identities/:identityId ─── (unlink)
  app.delete('/users/:userId/identities/:identityId', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { userId, identityId } = request.params as { userId: string; identityId: string };
    if (!(await ensureUserInOrg(userId, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const res = await pool.query(
      'DELETE FROM identities WHERE id = $1 AND user_id = $2 RETURNING id',
      [identityId, userId],
    );

    if (res.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Identity not found' },
      });
      return;
    }

    logger.info('Identity unlinked', { identity_id: identityId, user_id: userId });
    reply.send({ success: true });
  });

  // ─── GET /users/:id/identity-links ───
  app.get('/users/:id/identity-links', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: userId } = request.params as { id: string };
    if (!(await ensureUserInOrg(userId, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const res = await pool.query(
      `SELECT id, user_id, channel_type, channel_user_id, verified, linked_at, verified_at, verification_expires_at
       FROM identity_links
       WHERE user_id = $1
       ORDER BY linked_at DESC`,
      [userId],
    );
    reply.send({ success: true, data: res.rows });
  });

  // ─── POST /users/:id/identity-links ───
  app.post('/users/:id/identity-links', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: userId } = request.params as { id: string };
    if (!(await ensureUserInOrg(userId, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const bodyParsed = normalizeUserBody<{ channel_type?: string; channel_user_id?: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const channelType = String(body.channel_type || '').trim().toLowerCase();
    const channelUserId = String(body.channel_user_id || '').trim();
    if (!channelType || !channelUserId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel_type and channel_user_id are required' },
      });
    }

    const ttlSeconds = await getLinkVerificationTtlSeconds();
    const code = generateVerificationCode();
    const id = uuidv7();
    try {
      const inserted = await pool.query(
        `INSERT INTO identity_links
          (id, user_id, channel_type, channel_user_id, verified, verification_code, verification_expires_at, linked_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, $5, NOW() + ($6 || ' seconds')::interval, NOW(), NOW(), NOW())
         RETURNING id, user_id, channel_type, channel_user_id, verified, linked_at, verified_at, verification_expires_at`,
        [id, userId, channelType, channelUserId, code, String(ttlSeconds)],
      );
      reply.status(201).send({
        success: true,
        data: {
          ...inserted.rows[0],
          verification_hint: `Send the verification code from ${channelType}:${channelUserId}`,
        },
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'This channel identity link already exists' },
        });
      }
      throw err;
    }
  });

  // ─── POST /users/:id/identity-links/:linkId/verify ───
  app.post('/users/:id/identity-links/:linkId/verify', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: userId, linkId } = request.params as { id: string; linkId: string };
    if (!(await ensureUserInOrg(userId, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const bodyParsed = normalizeUserBody<{ code?: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const code = String(body.code || '').trim();
    if (!code) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'verification code is required' },
      });
    }
    const attemptScopeKey = `${orgId}:${userId}:${linkId}`;
    const attempt = consumeIdentityLinkVerifyAttempt(attemptScopeKey);
    if (!attempt.allowed) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many failed verification attempts. Please retry later.' },
        meta: { retry_after_seconds: attempt.retryAfterSeconds },
      });
    }
    const res = await pool.query(
      `UPDATE identity_links
       SET verified = true, verified_at = NOW(), verification_code = NULL, verification_expires_at = NULL, updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND verified = false
         AND verification_code = $3
         AND (verification_expires_at IS NULL OR verification_expires_at > NOW())
       RETURNING id, user_id, channel_type, channel_user_id, verified, linked_at, verified_at, verification_expires_at`,
      [linkId, userId, code],
    );
    if (res.rows.length === 0) {
      logger.warn('Identity link verification failed', { organization_id: orgId, user_id: userId, link_id: linkId });
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_CODE', message: 'Verification failed or link already verified/expired' },
      });
    }
    resetIdentityLinkVerifyAttempts(attemptScopeKey);
    reply.send({ success: true, data: res.rows[0] });
  });

  // ─── DELETE /users/:id/identity-links/:linkId ───
  app.delete('/users/:id/identity-links/:linkId', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: userId, linkId } = request.params as { id: string; linkId: string };
    if (!(await ensureUserInOrg(userId, orgId))) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const res = await pool.query(
      `DELETE FROM identity_links WHERE id = $1 AND user_id = $2 RETURNING id`,
      [linkId, userId],
    );
    if (res.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Identity link not found' },
      });
      return;
    }
    reply.send({ success: true });
  });
}
