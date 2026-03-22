import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

const PAIRING_SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);

type PairingSchemaCapabilities = {
  pairingRequestsOrgScoped: boolean;
  allowlistsOrgScoped: boolean;
  denylistsOrgScoped: boolean;
};

type PairingListRow = {
  id?: unknown;
  channel?: unknown;
  sender_id?: unknown;
  code?: unknown;
  status?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
  approved_at?: unknown;
  denied_at?: unknown;
};

function isPairingSchemaCompatError(err: unknown): boolean {
  const code = String((err as any)?.code || '');
  return PAIRING_SCHEMA_COMPAT_ERROR_CODES.has(code);
}

function sendPairingSchemaUnavailable(reply: any): void {
  reply.status(503).send({
    success: false,
    error: { code: 'FEATURE_UNAVAILABLE', message: 'Pairing schema is not ready' },
  });
}

function requirePlatformAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '') === 'platform_admin') return true;
  reply.status(403).send({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Platform admin privileges required' },
  });
  return false;
}

function currentOrgId(request: any): string | null {
  const direct = String(request?.orgId || '').trim();
  return direct || null;
}

async function detectPairingSchemaCapabilities(pool: pg.Pool): Promise<PairingSchemaCapabilities> {
  try {
    const res = await pool.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('pairing_requests', 'channel_allowlists', 'channel_denylists')
          AND column_name = 'organization_id'`,
    );
    const keys = new Set(
      (res.rows || []).map((row) => `${String(row.table_name || '')}.${String(row.column_name || '')}`),
    );
    return {
      pairingRequestsOrgScoped: keys.has('pairing_requests.organization_id'),
      allowlistsOrgScoped: keys.has('channel_allowlists.organization_id'),
      denylistsOrgScoped: keys.has('channel_denylists.organization_id'),
    };
  } catch {
    // Default to the modern schema if introspection is unavailable.
    return {
      pairingRequestsOrgScoped: true,
      allowlistsOrgScoped: true,
      denylistsOrgScoped: true,
    };
  }
}

function normalizePairingBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

function projectPairingListRow(row: PairingListRow) {
  return {
    id: String(row.id || ''),
    channel: String(row.channel || ''),
    sender_id: String(row.sender_id || ''),
    code: String(row.code || ''),
    status: String(row.status || ''),
    created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    expires_at: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    approved_at: row.approved_at ? new Date(String(row.approved_at)).toISOString() : null,
    denied_at: row.denied_at ? new Date(String(row.denied_at)).toISOString() : null,
  };
}

export async function registerPairingRoutes(app: FastifyInstance, pool: pg.Pool) {
  const schema = await detectPairingSchemaCapabilities(pool);

  app.post('/pairing/allowlist', async (request, reply) => {
    if (!requirePlatformAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const bodyParsed = normalizePairingBody<{ channel?: string; sender_id?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    const channel = String(body.channel || '').trim();
    const senderId = String(body.sender_id || '').trim();
    const userId = (request as any).userId as string | undefined;

    if (!channel || !senderId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel and sender_id are required' },
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

    try {
      if (schema.allowlistsOrgScoped) {
        await pool.query(
          `INSERT INTO channel_allowlists (id, organization_id, channel, sender_id, approved_at, approved_by)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           ON CONFLICT (organization_id, channel, sender_id) DO UPDATE
           SET approved_at = NOW(), approved_by = $5`,
          [uuidv7(), orgId, channel, senderId, userId],
        );
      } else {
        await pool.query(
          `INSERT INTO channel_allowlists (id, channel, sender_id, approved_at, approved_by)
           VALUES ($1, $2, $3, NOW(), $4)
           ON CONFLICT (channel, sender_id) DO UPDATE
           SET approved_at = NOW(), approved_by = $4`,
          [uuidv7(), channel, senderId, userId],
        );
      }
    } catch (err) {
      if (isPairingSchemaCompatError(err)) {
        request.log.warn({ err }, 'pairing schema not ready; allowlist unavailable');
        sendPairingSchemaUnavailable(reply);
        return;
      }
      throw err;
    }
    reply.send({ success: true, data: { channel, sender_id: senderId } });
  });

  app.get('/pairing', async (request, reply) => {
    if (!requirePlatformAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const userId = String((request as any).userId || '').trim();
    if (!userId) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
      return;
    }
    const query = request.query as { status?: string; channel?: string; limit?: string };
    let limit = 50;
    if (query.limit !== undefined) {
      const parsedLimit = Number(String(query.limit).trim());
      if (!Number.isFinite(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'limit must be a positive integer' },
        });
        return;
      }
      limit = Math.max(1, Math.min(200, parsedLimit));
    }
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (schema.pairingRequestsOrgScoped) {
      params.push(orgId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (query.status) {
      params.push(String(query.status));
      conditions.push(`status = $${params.length}`);
    }
    if (query.channel) {
      params.push(String(query.channel));
      conditions.push(`channel = $${params.length}`);
    }
    params.push(limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const res = await pool.query(
        `SELECT id, channel, sender_id, code, status, created_at, expires_at, approved_at, denied_at
         FROM pairing_requests
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      reply.send({
        success: true,
        data: res.rows.map((row) => projectPairingListRow(row as PairingListRow)),
      });
    } catch (err: any) {
      const code = String(err?.code || '');
      if (PAIRING_SCHEMA_COMPAT_ERROR_CODES.has(code)) {
        request.log.warn({ err }, 'pairing schema not ready; list unavailable');
        sendPairingSchemaUnavailable(reply);
        return;
      }
      throw err;
    }
  });

  app.post('/pairing/approve', async (request, reply) => {
    if (!requirePlatformAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const bodyParsed = normalizePairingBody<{ channel?: string; code?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    const channel = String(body.channel || '').trim();
    const code = String(body.code || '').trim();
    const userId = (request as any).userId as string | undefined;

    if (!channel || !code) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel and code are required' },
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const reqParams: unknown[] = [];
      const reqConditions: string[] = [];
      if (schema.pairingRequestsOrgScoped) {
        reqParams.push(orgId);
        reqConditions.push(`organization_id = $${reqParams.length}`);
      }
      reqParams.push(channel);
      reqConditions.push(`channel = $${reqParams.length}`);
      reqParams.push(code);
      reqConditions.push(`code = $${reqParams.length}`);
      reqConditions.push(`status = 'pending'`);
      reqConditions.push(`expires_at > NOW()`);
      const reqRes = await client.query(
        `SELECT id, sender_id
         FROM pairing_requests
         WHERE ${reqConditions.join('\n           AND ')}
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        reqParams,
      );
      if (reqRes.rows.length === 0) {
        await client.query('ROLLBACK');
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Pending pairing request not found or expired' },
        });
        return;
      }

      const requestId = String(reqRes.rows[0].id);
      const senderId = String(reqRes.rows[0].sender_id);
      await client.query(
        `UPDATE pairing_requests
         SET status = 'approved', approved_by = $2, approved_at = NOW()
         WHERE id = $1`,
        [requestId, userId],
      );
      if (schema.allowlistsOrgScoped) {
        await client.query(
          `INSERT INTO channel_allowlists (id, organization_id, channel, sender_id, approved_at, approved_by)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           ON CONFLICT (organization_id, channel, sender_id) DO UPDATE
           SET approved_at = NOW(), approved_by = $5`,
          [uuidv7(), orgId, channel, senderId, userId],
        );
      } else {
        await client.query(
          `INSERT INTO channel_allowlists (id, channel, sender_id, approved_at, approved_by)
           VALUES ($1, $2, $3, NOW(), $4)
           ON CONFLICT (channel, sender_id) DO UPDATE
           SET approved_at = NOW(), approved_by = $4`,
          [uuidv7(), channel, senderId, userId],
        );
      }
      await client.query('COMMIT');
      reply.send({
        success: true,
        data: { pairing_request_id: requestId, channel, sender_id: senderId, status: 'approved' },
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors and report original failure
      }
      if (isPairingSchemaCompatError(err)) {
        request.log.warn({ err }, 'pairing schema not ready; approve unavailable');
        sendPairingSchemaUnavailable(reply);
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/pairing/deny', async (request, reply) => {
    if (!requirePlatformAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const bodyParsed = normalizePairingBody<{ channel?: string; code?: string; block?: boolean }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    const channel = String(body.channel || '').trim();
    const code = String(body.code || '').trim();
    if (body.block !== undefined && typeof body.block !== 'boolean') {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'block must be a boolean when provided' },
      });
      return;
    }
    const block = body.block === true;
    const userId = (request as any).userId as string | undefined;

    if (!channel || !code) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel and code are required' },
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const denyParams: unknown[] = [];
      const denyConditions: string[] = [];
      if (schema.pairingRequestsOrgScoped) {
        denyParams.push(orgId);
        denyConditions.push(`organization_id = $${denyParams.length}`);
      }
      denyParams.push(channel);
      denyConditions.push(`channel = $${denyParams.length}`);
      denyParams.push(code);
      denyConditions.push(`code = $${denyParams.length}`);
      denyConditions.push(`status = 'pending'`);
      denyConditions.push(`expires_at > NOW()`);
      denyParams.push(userId);
      const denyByParam = denyParams.length;
      const res = await client.query(
        `UPDATE pairing_requests
         SET status = 'denied', denied_by = $${denyByParam}, denied_at = NOW()
         WHERE id = (
           SELECT id FROM pairing_requests
           WHERE ${denyConditions.join('\n             AND ')}
           ORDER BY created_at DESC
           LIMIT 1
         )
         RETURNING id, sender_id`,
        denyParams,
      );
      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Pending pairing request not found or expired' },
        });
        return;
      }

      if (block) {
        if (schema.denylistsOrgScoped) {
          await client.query(
            `INSERT INTO channel_denylists (id, organization_id, channel, sender_id, denied_at, denied_by)
             VALUES ($1, $2, $3, $4, NOW(), $5)
             ON CONFLICT (organization_id, channel, sender_id) DO UPDATE
             SET denied_at = NOW(), denied_by = $5`,
            [uuidv7(), orgId, channel, String(res.rows[0].sender_id), userId],
          );
        } else {
          await client.query(
            `INSERT INTO channel_denylists (id, channel, sender_id, denied_at, denied_by)
             VALUES ($1, $2, $3, NOW(), $4)
             ON CONFLICT (channel, sender_id) DO UPDATE
             SET denied_at = NOW(), denied_by = $4`,
            [uuidv7(), channel, String(res.rows[0].sender_id), userId],
          );
        }
      }

      await client.query('COMMIT');
      reply.send({
        success: true,
        data: {
          pairing_request_id: res.rows[0].id,
          channel,
          sender_id: res.rows[0].sender_id,
          status: 'denied',
          blocked: block,
        },
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors and report original failure
      }
      if (isPairingSchemaCompatError(err)) {
        request.log.warn({ err }, 'pairing schema not ready; deny unavailable');
        sendPairingSchemaUnavailable(reply);
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
