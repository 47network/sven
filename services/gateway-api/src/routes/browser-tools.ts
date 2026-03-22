import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireRole } from './auth.js';
import { BrowserAutomationService } from '../services/BrowserAutomationService.js';

export async function registerBrowserToolRoutes(app: FastifyInstance, pool: pg.Pool) {
  const authenticated = requireRole(pool, 'admin', 'user');
  const browser = new BrowserAutomationService(pool);
  const writeActions = new Set(['click', 'type', 'fill_form', 'select', 'evaluate', 'upload_file']);
  const relayWritePermissions = new Set(['click', 'type', 'submit', 'download', 'clipboard_write']);
  const relayPermissionByCommand = new Map<string, string>([
    ['get_url', 'read_url'],
    ['get_dom', 'read_dom'],
    ['get_text', 'read_dom'],
    ['snapshot', 'capture_screenshot'],
    ['get_html', 'capture_html'],
    ['click', 'click'],
    ['type', 'type'],
    ['submit', 'submit'],
    ['download', 'download'],
    ['clipboard_read', 'clipboard_read'],
    ['clipboard_write', 'clipboard_write'],
  ]);
  const sensitiveAuditKeys = new Set([
    'text',
    'script',
    'password',
    'secret',
    'token',
    'authorization',
    'cookie',
    'api_key',
    'apikey',
    'value',
  ]);

  function isSensitiveAuditKey(raw: string): boolean {
    const key = String(raw || '').trim().toLowerCase();
    return sensitiveAuditKeys.has(key) || key.endsWith('_token') || key.endsWith('_secret') || key.endsWith('_password');
  }

  function sanitizeAuditScalar(value: unknown): unknown {
    if (typeof value === 'string') {
      return '[REDACTED]';
    }
    return value;
  }

  function sanitizeAuditDetails(value: unknown, parentKey?: string): unknown {
    if (parentKey && isSensitiveAuditKey(parentKey)) {
      return sanitizeAuditScalar(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeAuditDetails(item));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        out[key] = sanitizeAuditDetails(nested, key);
      }
      return out;
    }
    return value;
  }

  function sanitizeAuditError(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    return raw
      .replace(/(bearer\s+)[^\s]+/ig, '$1[REDACTED]')
      .replace(/sk-[a-z0-9_-]+/ig, '[REDACTED]')
      .replace(/(token=)[^&\s]+/ig, '$1[REDACTED]');
  }

  function sanitizeBrowserAuditRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      ...row,
      details: sanitizeAuditDetails(row.details),
      error: sanitizeAuditError(row.error),
    };
  }

  async function logAudit(params: {
    userId?: string;
    profileId?: string;
    action: string;
    status: 'success' | 'error' | 'denied';
    details?: Record<string, unknown>;
    error?: string;
  }) {
    try {
      await pool.query(
        `INSERT INTO browser_audit_logs (id, user_id, profile_id, action, status, details, error, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          uuidv7(),
          params.userId || null,
          params.profileId || null,
          params.action,
          params.status,
          JSON.stringify(sanitizeAuditDetails(params.details || {})),
          sanitizeAuditError(params.error),
        ],
      );
    } catch {
      // Best effort audit path while migration is rolling out.
    }
  }

  async function isApprovalValid(approvalId: string, userId: string): Promise<boolean> {
    const res = await pool.query(
      `SELECT id
       FROM approvals
       WHERE id = $1
         AND requester_user_id = $2
         AND status = 'approved'
         AND expires_at > NOW()
       LIMIT 1`,
      [approvalId, userId],
    );
    return res.rows.length > 0;
  }

  function parseStringArray(input: unknown, maxItems = 128): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    for (const item of input) {
      const value = String(item || '').trim();
      if (!value) continue;
      if (!out.includes(value)) out.push(value);
      if (out.length >= maxItems) break;
    }
    return out;
  }

  function normalizeOrigin(raw: string): string | null {
    const candidate = String(raw || '').trim();
    if (!candidate) return null;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url.origin.toLowerCase();
    } catch {
      return null;
    }
  }

  function normalizeDomain(raw: string): string | null {
    const candidate = String(raw || '').trim().toLowerCase();
    if (!candidate) return null;
    const withProtocol = candidate.includes('://') ? candidate : `https://${candidate}`;
    try {
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase();
      if (!host) return null;
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null;
      return host;
    } catch {
      return null;
    }
  }

  function hashRelaySecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  function verifyRelaySecret(secret: string, expectedHash: string): boolean {
    if (!secret || !expectedHash) return false;
    const left = Buffer.from(hashRelaySecret(secret));
    const right = Buffer.from(expectedHash);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  function relayStatusToDb(status: string): 'completed' | 'error' | 'denied' {
    if (status === 'ok') return 'completed';
    if (status === 'denied') return 'denied';
    return 'error';
  }

  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  function relayCanAccessHost(host: string, allowedDomains: string[]): boolean {
    if (allowedDomains.length === 0) return false;
    const normalizedHost = host.toLowerCase();
    for (const domain of allowedDomains) {
      const pattern = domain.toLowerCase();
      if (pattern === '*') return true;
      if (normalizedHost === pattern) return true;
      if (normalizedHost.endsWith(`.${pattern}`)) return true;
    }
    return false;
  }

  function extractRelayTargetHost(input: Record<string, unknown>): string | null {
    const rawCandidates = [input.target_url, input.url, (input.payload as any)?.url];
    for (const candidate of rawCandidates) {
      const raw = String(candidate || '').trim();
      if (!raw) continue;
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return null;
        }
        return parsed.hostname.toLowerCase();
      } catch {
        return null;
      }
    }
    return null;
  }

  async function loadRelaySessionForUser(
    relaySessionId: string,
    userId: string,
    orgId: string,
    includeExpired = false,
  ): Promise<any | null> {
    const query = includeExpired
      ? `SELECT *
         FROM browser_relay_sessions
         WHERE id = $1 AND user_id = $2 AND organization_id = $3
         LIMIT 1`
      : `SELECT *
         FROM browser_relay_sessions
         WHERE id = $1
           AND user_id = $2
           AND organization_id = $3
           AND status = 'active'
           AND expires_at > NOW()
         LIMIT 1`;
    const res = await pool.query(query, [relaySessionId, userId, orgId]);
    return res.rows[0] || null;
  }

  async function loadRelaySessionForExtension(
    relaySessionId: string,
    relayToken: string,
    origin: string,
  ): Promise<any | null> {
    const res = await pool.query(
      `SELECT *
       FROM browser_relay_sessions
       WHERE id = $1
         AND status = 'active'
         AND expires_at > NOW()
       LIMIT 1`,
      [relaySessionId],
    );
    const row = res.rows[0];
    if (!row) return null;
    if (!verifyRelaySecret(relayToken, String(row.extension_secret_hash || ''))) {
      return null;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
      return null;
    }
    const allowedOrigins = parseStringArray(row.allowed_origins || []);
    if (allowedOrigins.length === 0) {
      return null;
    }
    if (!allowedOrigins.includes(normalizedOrigin)) {
      return null;
    }

    return row;
  }

  app.get('/v1/tools/browser/profiles', { preHandler: authenticated }, async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const profiles = await browser.listProfiles(orgId);
    reply.send({ success: true, data: profiles });
  });

  app.post('/v1/tools/browser/profiles', { preHandler: authenticated }, async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const body = request.body as { name?: string };
    const name = (body?.name || '').trim();
    if (!name) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name is required' },
      });
      return;
    }
    const created = await browser.createProfile(name, orgId);
    reply.send({ success: true, data: created });
  });

  app.post('/v1/tools/browser/navigate', { preHandler: authenticated }, async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const body = request.body as { profile_id?: string; url?: string };
    const profileId = body.profile_id;
    const url = body.url;
    const userId = (request as any).userId as string | undefined;

    if (!profileId || !url) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'profile_id and url are required' },
      });
      return;
    }
    try {
      const data = await browser.navigate(profileId, url, orgId);
      await logAudit({
        userId,
        profileId,
        action: 'navigate',
        status: 'success',
        details: { url },
      });
      reply.send({ success: true, data });
    } catch (err) {
      await logAudit({
        userId,
        profileId,
        action: 'navigate',
        status: 'error',
        details: { url },
        error: String(err),
      });
      throw err;
    }
  });

  app.post('/v1/tools/browser/snapshot', { preHandler: authenticated }, async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const body = request.body as { profile_id?: string; full_page?: boolean; selector?: string };
    const profileId = body.profile_id;
    const userId = (request as any).userId as string | undefined;
    if (!profileId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'profile_id is required' },
      });
      return;
    }
    try {
      const data = await browser.snapshot(profileId, orgId, body.full_page !== false, body.selector);
      await logAudit({
        userId,
        profileId,
        action: 'snapshot',
        status: 'success',
        details: { full_page: body.full_page !== false, selector: body.selector || null },
      });
      reply.send({ success: true, data });
    } catch (err) {
      await logAudit({
        userId,
        profileId,
        action: 'snapshot',
        status: 'error',
        details: { full_page: body.full_page !== false, selector: body.selector || null },
        error: String(err),
      });
      throw err;
    }
  });

  app.post('/v1/tools/browser/action', { preHandler: authenticated }, async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const body = request.body as {
      profile_id?: string;
      action?: string;
      approval_id?: string;
      [key: string]: unknown;
    };
    const userId = (request as any).userId as string | undefined;

    const profileId = body.profile_id;
    const action = body.action;
    if (!profileId || !action) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'profile_id and action are required' },
      });
      return;
    }

    if (writeActions.has(action)) {
      const approvalId = String(body.approval_id || '');
      if (!userId || !approvalId || !(await isApprovalValid(approvalId, userId))) {
        await logAudit({
          userId,
          profileId,
          action,
          status: 'denied',
          details: { reason: 'missing_or_invalid_approval', approval_id: approvalId || null },
        });
        reply.status(403).send({
          success: false,
          error: {
            code: 'APPROVAL_REQUIRED',
            message: `Action "${action}" requires a valid approved approval_id.`,
          },
        });
        return;
      }
    }

    try {
      const data = await browser.action(profileId, action, body, orgId);
      await logAudit({
        userId,
        profileId,
        action,
        status: 'success',
        details: body as Record<string, unknown>,
      });
      reply.send({ success: true, data });
    } catch (err) {
      await logAudit({
        userId,
        profileId,
        action,
        status: 'error',
        details: body as Record<string, unknown>,
        error: String(err),
      });
      throw err;
    }
  });

  app.get('/v1/tools/browser/status', { preHandler: authenticated }, async (request: any, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }

    if (String(request.userRole || '').trim() === 'platform_admin') {
      const data = await browser.status();
      reply.send({ success: true, data: { ...data, scope: 'global' } });
      return;
    }

    const scopedRes = await pool.query(
      `SELECT COUNT(*)::int AS active_profiles
       FROM browser_profiles
       WHERE organization_id = $1`,
      [orgId],
    );
    const activeProfiles = Number(scopedRes.rows[0]?.active_profiles || 0);
    reply.send({
      success: true,
      data: {
        browser_started: activeProfiles > 0,
        active_profiles: activeProfiles,
        scope: 'organization',
      },
    });
  });

  app.post('/v1/tools/browser/lifecycle', { preHandler: authenticated }, async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const body = request.body as { action?: string; profile_id?: string };
    const action = String(body.action || '').trim().toLowerCase();
    const profileId = body.profile_id ? String(body.profile_id) : undefined;
    const userId = (request as any).userId as string | undefined;
    const isPlatformAdmin = String((request as any).userRole || '').trim() === 'platform_admin';

    if (!['start', 'stop', 'restart'].includes(action)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'action must be one of: start, stop, restart' },
      });
      return;
    }

    if ((action === 'start' || action === 'restart') && !isPlatformAdmin) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global browser lifecycle actions require platform admin privileges' },
      });
      return;
    }
    if (action === 'stop' && !profileId && !isPlatformAdmin) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global browser stop requires platform admin privileges' },
      });
      return;
    }

    try {
      let data: Record<string, unknown>;
      if (action === 'start') {
        data = await browser.start();
      } else if (action === 'restart') {
        data = await browser.restart();
      } else {
        data = await browser.stop(profileId, orgId);
      }
      await logAudit({
        userId,
        profileId,
        action: `lifecycle:${action}`,
        status: 'success',
        details: { profile_id: profileId || null },
      });
      reply.send({ success: true, data });
    } catch (err) {
      await logAudit({
        userId,
        profileId,
        action: `lifecycle:${action}`,
        status: 'error',
        details: { profile_id: profileId || null },
        error: String(err),
      });
      throw err;
    }
  });

  app.get('/v1/tools/browser/audit', { preHandler: authenticated }, async (request, reply) => {
    const query = request.query as { profile_id?: string; limit?: string };
    const userId = (request as any).userId as string | undefined;
    const limit = Math.max(1, Math.min(500, Number(query.limit || 50)));

    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (userId) {
      params.push(userId);
      where += ` AND user_id = $${params.length}`;
    }
    if (query.profile_id) {
      params.push(String(query.profile_id));
      where += ` AND profile_id = $${params.length}`;
    }

    params.push(limit);
    const res = await pool.query(
      `SELECT id, user_id, profile_id, action, status, details, error, created_at
       FROM browser_audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    const sanitizedRows = res.rows.map((row) => sanitizeBrowserAuditRow(row as Record<string, unknown>));
    reply.send({ success: true, data: sanitizedRows });
  });

  app.post('/v1/tools/browser/relay/sessions', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string | undefined;
    const orgId = currentOrgId(request);
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const name = String(body.name || '').trim() || `relay-${new Date().toISOString()}`;
    const rawTtl = Number(body.ttl_minutes || 120);
    const maxTtl = Math.max(5, Number(process.env.BROWSER_RELAY_MAX_TTL_MINUTES || 720));
    const ttlMinutes = Math.max(5, Math.min(maxTtl, Number.isFinite(rawTtl) ? rawTtl : 120));

    const allowedDomains = parseStringArray(body.allowed_domains || []).map(normalizeDomain).filter(Boolean) as string[];
    if (allowedDomains.length === 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'allowed_domains must include at least one domain' },
      });
      return;
    }

    const rawPermissions = parseStringArray(body.permissions || []);
    const permissions = rawPermissions.length > 0 ? rawPermissions : ['read_url', 'read_dom', 'capture_screenshot'];
    const invalidPermission = permissions.find((p) => !Array.from(relayPermissionByCommand.values()).includes(p));
    if (invalidPermission) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Unsupported permission: ${invalidPermission}` },
      });
      return;
    }

    const allowedOrigins = parseStringArray(body.allowed_origins || [])
      .map((item) => normalizeOrigin(item))
      .filter(Boolean) as string[];
    if (allowedOrigins.length === 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'allowed_origins must include at least one origin' },
      });
      return;
    }
    const relaySessionId = uuidv7();
    const relayToken = randomBytes(24).toString('base64url');
    const relayTokenHash = hashRelaySecret(relayToken);
    const maxCommandAgeSeconds = Math.max(
      30,
      Math.min(3600, Number(body.max_command_age_seconds || process.env.BROWSER_RELAY_MAX_COMMAND_AGE_SECONDS || 300)),
    );

    const created = await pool.query(
      `INSERT INTO browser_relay_sessions
       (id, user_id, organization_id, name, status, allowed_domains, permissions, allowed_origins, extension_secret_hash, max_command_age_seconds, created_at, expires_at, metadata)
       VALUES ($1, $2, $3, $4, 'active', $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, NOW(), NOW() + ($10 || ' minutes')::interval, '{}'::jsonb)
       RETURNING id, user_id, organization_id, name, status, allowed_domains, permissions, allowed_origins, max_command_age_seconds, created_at, expires_at, last_seen_at, metadata`,
      [
        relaySessionId,
        userId,
        orgId,
        name,
        JSON.stringify(allowedDomains),
        JSON.stringify(permissions),
        JSON.stringify(allowedOrigins),
        relayTokenHash,
        maxCommandAgeSeconds,
        String(ttlMinutes),
      ],
    );

    await logAudit({
      userId,
      action: 'relay_session_create',
      status: 'success',
      details: {
        relay_session_id: relaySessionId,
        allowed_domains: allowedDomains,
        permissions,
        allowed_origins: allowedOrigins,
        ttl_minutes: ttlMinutes,
      },
    });

    reply.send({
      success: true,
      data: {
        ...created.rows[0],
        extension_token: relayToken,
      },
    });
  });

  app.get('/v1/tools/browser/relay/sessions', { preHandler: authenticated }, async (request, reply) => {
    const userId = (request as any).userId as string | undefined;
    const orgId = currentOrgId(request);
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const res = await pool.query(
      `SELECT id, user_id, organization_id, name, status, allowed_domains, permissions, allowed_origins, max_command_age_seconds, created_at, expires_at, last_seen_at, metadata
       FROM browser_relay_sessions
       WHERE user_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId, orgId],
    );
    reply.send({ success: true, data: res.rows });
  });

  app.post('/v1/tools/browser/relay/sessions/:id/revoke', { preHandler: authenticated }, async (request, reply) => {
    const relaySessionId = String((request.params as any).id || '').trim();
    const userId = (request as any).userId as string | undefined;
    const orgId = currentOrgId(request);
    if (!relaySessionId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'id is required' },
      });
      return;
    }
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const updated = await pool.query(
      `UPDATE browser_relay_sessions
       SET status = 'revoked', expires_at = NOW()
       WHERE id = $1 AND user_id = $2 AND organization_id = $3 AND status = 'active'
       RETURNING id, status, expires_at`,
      [relaySessionId, userId, orgId],
    );
    if (updated.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'relay session not found' },
      });
      return;
    }
    await logAudit({
      userId,
      action: 'relay_session_revoke',
      status: 'success',
      details: { relay_session_id: relaySessionId },
    });
    reply.send({ success: true, data: updated.rows[0] });
  });

  app.post('/v1/tools/browser/relay/sessions/:id/commands', { preHandler: authenticated }, async (request, reply) => {
    const relaySessionId = String((request.params as any).id || '').trim();
    const userId = (request as any).userId as string | undefined;
    const orgId = currentOrgId(request);
    const body = (request.body || {}) as Record<string, unknown>;
    const command = String(body.command || '').trim().toLowerCase();
    if (!relaySessionId || !command) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'id and command are required' },
      });
      return;
    }
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }

    const relaySession = await loadRelaySessionForUser(relaySessionId, userId, orgId);
    if (!relaySession) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'relay session not found or inactive' },
      });
      return;
    }

    const permission = relayPermissionByCommand.get(command);
    if (!permission) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Unsupported relay command: ${command}` },
      });
      return;
    }

    const granted = parseStringArray(relaySession.permissions || []);
    if (!granted.includes(permission)) {
      await logAudit({
        userId,
        action: 'relay_command_dispatch',
        status: 'denied',
        details: { relay_session_id: relaySessionId, command, reason: 'permission_not_granted', permission },
      });
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: `Relay permission "${permission}" is not granted for this session` },
      });
      return;
    }

    const targetHost = extractRelayTargetHost(body);
    if (targetHost) {
      const allowedDomains = parseStringArray(relaySession.allowed_domains || []).map((d) => d.toLowerCase());
      if (!relayCanAccessHost(targetHost, allowedDomains)) {
        await logAudit({
          userId,
          action: 'relay_command_dispatch',
          status: 'denied',
          details: { relay_session_id: relaySessionId, command, reason: 'domain_not_allowed', target_host: targetHost },
        });
        reply.status(403).send({
          success: false,
          error: { code: 'DOMAIN_BLOCKED', message: `Target domain not allowed for relay session: ${targetHost}` },
        });
        return;
      }
    }

    const approvalId = String(body.approval_id || '').trim();
    if (relayWritePermissions.has(permission)) {
      if (!approvalId || !(await isApprovalValid(approvalId, userId))) {
        await logAudit({
          userId,
          action: 'relay_command_dispatch',
          status: 'denied',
          details: { relay_session_id: relaySessionId, command, reason: 'missing_or_invalid_approval' },
        });
        reply.status(403).send({
          success: false,
          error: { code: 'APPROVAL_REQUIRED', message: `Relay command "${command}" requires a valid approval_id` },
        });
        return;
      }
    }

    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const insert = await pool.query(
      `INSERT INTO browser_relay_commands
       (id, session_id, user_id, organization_id, command, payload, status, approval_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'queued', $7, NOW())
       RETURNING id, session_id, user_id, organization_id, command, payload, status, approval_id, created_at`,
      [uuidv7(), relaySessionId, userId, orgId, command, JSON.stringify(payload), approvalId || null],
    );

    await logAudit({
      userId,
      action: 'relay_command_dispatch',
      status: 'success',
      details: {
        relay_session_id: relaySessionId,
        command,
        command_id: insert.rows[0].id,
      },
    });

    reply.send({ success: true, data: insert.rows[0] });
  });

  app.get('/v1/tools/browser/relay/sessions/:id/commands', { preHandler: authenticated }, async (request, reply) => {
    const relaySessionId = String((request.params as any).id || '').trim();
    const userId = (request as any).userId as string | undefined;
    const orgId = currentOrgId(request);
    if (!relaySessionId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'id is required' },
      });
      return;
    }
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const relaySession = await loadRelaySessionForUser(relaySessionId, userId, orgId, true);
    if (!relaySession) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'relay session not found' },
      });
      return;
    }
    const limit = Math.max(1, Math.min(300, Number((request.query as any)?.limit || 50)));
    const result = await pool.query(
      `SELECT id, session_id, user_id, organization_id, command, payload, status, approval_id, result, error, created_at, delivered_at, completed_at
       FROM browser_relay_commands
       WHERE session_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [relaySessionId, orgId, limit],
    );
    reply.send({ success: true, data: result.rows });
  });

  app.post('/v1/tools/browser/relay/sessions/:id/heartbeat', async (request, reply) => {
    const relaySessionId = String((request.params as any).id || '').trim();
    const relayToken = String(request.headers['x-sven-relay-token'] || '').trim();
    const origin = String(request.headers.origin || '').trim();
    if (!relaySessionId || !relayToken) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Relay token is required' },
      });
      return;
    }

    const relaySession = await loadRelaySessionForExtension(relaySessionId, relayToken, origin);
    if (!relaySession) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Invalid relay session token or origin' },
      });
      return;
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const currentUrl = String(body.current_url || '').trim();
    if (currentUrl) {
      try {
        const host = new URL(currentUrl).hostname.toLowerCase();
        const allowedDomains = parseStringArray(relaySession.allowed_domains || []).map((d) => d.toLowerCase());
        if (!relayCanAccessHost(host, allowedDomains)) {
          reply.status(403).send({
            success: false,
            error: { code: 'DOMAIN_BLOCKED', message: `Current URL is outside allowed relay domains: ${host}` },
          });
          return;
        }
      } catch {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'current_url must be a valid http/https URL' },
        });
        return;
      }
    }

    const metadataPatch = {
      current_url: currentUrl || null,
      title: String(body.title || '').trim() || null,
      extension_version: String(body.extension_version || '').trim() || null,
      capabilities: parseStringArray(body.capabilities || []),
      ts: new Date().toISOString(),
    };
    const updated = await pool.query(
      `UPDATE browser_relay_sessions
       SET last_seen_at = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING id, status, last_seen_at, metadata`,
      [relaySessionId, JSON.stringify(metadataPatch)],
    );

    reply.send({ success: true, data: updated.rows[0] || null });
  });

  app.get('/v1/tools/browser/relay/sessions/:id/commands/pull', async (request, reply) => {
    const relaySessionId = String((request.params as any).id || '').trim();
    const relayToken = String(request.headers['x-sven-relay-token'] || '').trim();
    const origin = String(request.headers.origin || '').trim();
    if (!relaySessionId || !relayToken) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Relay token is required' },
      });
      return;
    }

    const relaySession = await loadRelaySessionForExtension(relaySessionId, relayToken, origin);
    if (!relaySession) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Invalid relay session token or origin' },
      });
      return;
    }

    const maxAgeSeconds = Math.max(30, Math.min(3600, Number(relaySession.max_command_age_seconds || 300)));
    await pool.query(
      `UPDATE browser_relay_commands
       SET status = 'expired', completed_at = NOW(), error = COALESCE(error, 'command expired before delivery')
       WHERE session_id = $1
         AND status = 'queued'
         AND created_at < NOW() - ($2 || ' seconds')::interval`,
      [relaySessionId, String(maxAgeSeconds)],
    );

    const limit = Math.max(1, Math.min(50, Number((request.query as any)?.limit || 20)));
    const commands = await pool.query(
      `WITH claimed AS (
         SELECT id
         FROM browser_relay_commands
         WHERE session_id = $1
           AND status = 'queued'
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       UPDATE browser_relay_commands c
       SET status = 'delivered',
           delivered_at = NOW()
       FROM claimed
       WHERE c.id = claimed.id
       RETURNING c.id, c.session_id, c.command, c.payload, c.approval_id, c.created_at`,
      [relaySessionId, limit],
    );

    await pool.query(
      `UPDATE browser_relay_sessions
       SET last_seen_at = NOW()
       WHERE id = $1`,
      [relaySessionId],
    );

    reply.send({ success: true, data: commands.rows });
  });

  app.post('/v1/tools/browser/relay/sessions/:id/commands/:commandId/result', async (request, reply) => {
    const relaySessionId = String((request.params as any).id || '').trim();
    const commandId = String((request.params as any).commandId || '').trim();
    const relayToken = String(request.headers['x-sven-relay-token'] || '').trim();
    const origin = String(request.headers.origin || '').trim();
    const body = (request.body || {}) as Record<string, unknown>;
    const status = String(body.status || '').trim().toLowerCase();
    if (!relaySessionId || !commandId || !relayToken) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Relay token is required' },
      });
      return;
    }
    if (!['ok', 'error', 'denied'].includes(status)) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status must be one of: ok, error, denied' },
      });
      return;
    }

    const relaySession = await loadRelaySessionForExtension(relaySessionId, relayToken, origin);
    if (!relaySession) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Invalid relay session token or origin' },
      });
      return;
    }

    const dbStatus = relayStatusToDb(status);
    const updated = await pool.query(
      `UPDATE browser_relay_commands
       SET status = $4,
           result = $5::jsonb,
           error = $6,
           completed_at = NOW()
       WHERE id = $1
         AND session_id = $2
         AND status IN ('queued', 'delivered')
       RETURNING id, session_id, command, status, result, error, completed_at`,
      [
        commandId,
        relaySessionId,
        relaySession.user_id,
        dbStatus,
        JSON.stringify(body.result && typeof body.result === 'object' ? body.result : {}),
        body.error ? String(body.error) : null,
      ],
    );
    if (updated.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'relay command not found or already completed' },
      });
      return;
    }

    await pool.query(
      `UPDATE browser_relay_sessions
       SET last_seen_at = NOW()
       WHERE id = $1`,
      [relaySessionId],
    );
    await logAudit({
      userId: String(relaySession.user_id),
      action: 'relay_command_result',
      status: dbStatus === 'completed' ? 'success' : dbStatus === 'denied' ? 'denied' : 'error',
      details: {
        relay_session_id: relaySessionId,
        command_id: commandId,
        relay_status: status,
      },
      error: body.error ? String(body.error) : undefined,
    });
    reply.send({ success: true, data: updated.rows[0] });
  });
}
