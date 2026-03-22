import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';

const logger = createLogger('admin-chats');

function normalizeChatBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

const VALID_CHAT_TYPES = ['dm', 'group', 'hq'];

function parseBooleanSettingValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const raw = value.trim();
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'boolean') return parsed;
      if (typeof parsed === 'string') return parsed.toLowerCase() === 'true';
      if (typeof parsed === 'number') return parsed !== 0;
    } catch {
      const lowered = raw.toLowerCase();
      if (lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on') return true;
      if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === 'off') return false;
    }
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

async function isSessionIndexingEnabled(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const agentRes = await pool.query(
      `SELECT c.settings ->> 'memory_index_sessions_enabled' AS enabled
       FROM agent_sessions s
       JOIN agent_configs c ON c.agent_id = s.agent_id
       WHERE s.session_id = $1`,
      [chatId],
    );
    if (agentRes.rows.length > 0) {
      for (const row of agentRes.rows) {
        if (parseBooleanSettingValue(row.enabled, false)) return true;
      }
      return false;
    }
  } catch {
    // Fall through to global setting
  }

  try {
    const globalRes = await pool.query(
      `SELECT value FROM settings_global WHERE key = 'memory.indexSessions.enabled' LIMIT 1`,
    );
    if (globalRes.rows.length === 0) return false;
    return parseBooleanSettingValue(globalRes.rows[0].value, false);
  } catch {
    return false;
  }
}

async function getSessionIndexConsent(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT memory_index_consent FROM session_settings WHERE session_id = $1 LIMIT 1`,
      [chatId],
    );
    return Boolean(res.rows[0]?.memory_index_consent);
  } catch {
    return false;
  }
}

async function indexSessionTranscriptIntoMemory(
  pool: pg.Pool,
  chatId: string,
): Promise<{ indexed: boolean; reason?: string; memory_id?: string }> {
  const enabled = await isSessionIndexingEnabled(pool, chatId);
  if (!enabled) return { indexed: false, reason: 'disabled' };

  const consent = await getSessionIndexConsent(pool, chatId);
  if (!consent) return { indexed: false, reason: 'consent_required' };

  let since: string | null = null;
  try {
    const s = await pool.query(
      `SELECT memory_last_indexed_at FROM session_settings WHERE session_id = $1 LIMIT 1`,
      [chatId],
    );
    since = s.rows[0]?.memory_last_indexed_at ? new Date(s.rows[0].memory_last_indexed_at).toISOString() : null;
  } catch {
    since = null;
  }

  const msgRes = await pool.query(
    `SELECT role, text, created_at
     FROM messages
     WHERE chat_id = $1
       AND role IN ('user', 'assistant')
       AND ($2::timestamptz IS NULL OR created_at > $2::timestamptz)
     ORDER BY created_at ASC
     LIMIT 400`,
    [chatId, since],
  );

  const toolRes = await pool.query(
    `SELECT tool_name, outputs, created_at
     FROM tool_runs
     WHERE chat_id = $1
       AND status = 'success'
       AND ($2::timestamptz IS NULL OR created_at > $2::timestamptz)
     ORDER BY created_at ASC
     LIMIT 120`,
    [chatId, since],
  );

  if (msgRes.rows.length === 0 && toolRes.rows.length === 0) {
    return { indexed: false, reason: 'no_new_events' };
  }

  const lines: string[] = [];
  for (const row of msgRes.rows) {
    const ts = new Date(row.created_at).toISOString();
    lines.push(`[${ts}] ${String(row.role)}: ${String(row.text || '').replace(/\s+/g, ' ').trim()}`);
  }
  for (const row of toolRes.rows) {
    const ts = new Date(row.created_at).toISOString();
    const outputs = row.outputs ? JSON.stringify(row.outputs) : '(no output)';
    lines.push(`[${ts}] tool:${String(row.tool_name)} => ${outputs.slice(0, 1200)}`);
  }

  const memoryId = uuidv7();
  const key = `session.transcript.${chatId}.${Date.now()}`;
  const value = lines.join('\n').slice(0, 64000);
  await pool.query(
    `INSERT INTO memories (id, user_id, chat_id, visibility, key, value, source, importance, created_at, updated_at)
     VALUES ($1, NULL, $2, 'chat_shared', $3, $4, 'session', 1.05, NOW(), NOW())`,
    [memoryId, chatId, key, value],
  );

  await pool.query(
    `INSERT INTO session_settings (session_id, memory_index_consent, memory_last_indexed_at)
     VALUES ($1, TRUE, NOW())
     ON CONFLICT (session_id) DO UPDATE
     SET memory_last_indexed_at = NOW()`,
    [chatId],
  );

  return { indexed: true, memory_id: memoryId };
}

export async function registerChatRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  // ─── GET /chats ───
  app.get('/chats', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = request.query as { page?: string; per_page?: string; type?: string };
    const pagination = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage: 100 });
    if (!pagination.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: pagination.message },
      });
    }
    const { page, perPage, offset } = pagination;

    let where = `WHERE organization_id = $1`;
    const params: unknown[] = [orgId];
    if (query.type && VALID_CHAT_TYPES.includes(query.type)) {
      params.push(query.type);
      where += ` AND type = $${params.length}`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM chats ${where}`, params);
    const total: number = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, name, type, channel, channel_chat_id, created_at, updated_at
       FROM chats ${where}
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

  // ─── GET /chats/:id ───
  app.get('/chats/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT id, name, type, channel, channel_chat_id, created_at, updated_at
       FROM chats WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found' },
      });
      return;
    }

    const members = await pool.query(
      `SELECT cm.id, cm.user_id, cm.role, cm.joined_at, u.username, u.display_name
       FROM chat_members cm JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = $1 ORDER BY cm.joined_at`,
      [id],
    );

    reply.send({
      success: true,
      data: { ...result.rows[0], members: members.rows },
    });
  });

  // ─── POST /chats ───
  app.post('/chats', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const bodyParsed = normalizeChatBody<{
      name?: string;
      type?: string;
      channel?: string;
      channel_chat_id?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    if (!body.name) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name is required' },
      });
      return;
    }

    const type = body.type && VALID_CHAT_TYPES.includes(body.type) ? body.type : 'group';

    // Only one HQ chat allowed
    if (type === 'hq') {
      const existing = await pool.query(`SELECT 1 FROM chats WHERE type = 'hq' AND organization_id = $1 LIMIT 1`, [orgId]);
      if (existing.rows.length > 0) {
        reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Only one HQ chat is allowed' },
        });
        return;
      }
    }

    const id = uuidv7();
    try {
      await pool.query(
        `INSERT INTO chats (id, organization_id, name, type, channel, channel_chat_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [id, orgId, body.name, type, body.channel || null, body.channel_chat_id || null],
      );
    } catch (err: any) {
      if (type === 'hq' && err?.code === '23505') {
        reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Only one HQ chat is allowed' },
        });
        return;
      }
      throw err;
    }

    logger.info('Chat created', { chat_id: id, name: body.name, type });
    reply.status(201).send({ success: true, data: { id, name: body.name, type } });
  });

  // ─── PATCH /chats/:id ───
  app.patch('/chats/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeChatBody<{ name?: string; channel?: string; channel_chat_id?: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { params.push(body.name); sets.push(`name = $${params.length}`); }
    if (body.channel !== undefined) { params.push(body.channel); sets.push(`channel = $${params.length}`); }
    if (body.channel_chat_id !== undefined) { params.push(body.channel_chat_id); sets.push(`channel_chat_id = $${params.length}`); }

    if (sets.length === 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'No fields to update' },
      });
      return;
    }

    params.push(id);
    const res = await pool.query(
      `UPDATE chats SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} AND organization_id = $${params.length + 1}
       RETURNING id, name, type, channel, channel_chat_id, updated_at`,
      [...params, orgId],
    );

    if (res.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found' },
      });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  // Keep PUT for backward compat
  app.put('/chats/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeChatBody<{ name?: string | null; channel?: string | null; channel_chat_id?: string | null }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.name !== undefined) { params.push(body.name); sets.push(`name = $${params.length}`); }
    if (body.channel !== undefined) { params.push(body.channel); sets.push(`channel = $${params.length}`); }
    if (body.channel_chat_id !== undefined) { params.push(body.channel_chat_id); sets.push(`channel_chat_id = $${params.length}`); }
    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Nothing to update' } });
      return;
    }
    params.push(id);
    const res = await pool.query(
      `UPDATE chats SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} AND organization_id = $${params.length + 1}
       RETURNING id, name, type, channel, channel_chat_id, updated_at`,
      [...params, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
      return;
    }
    reply.send({ success: true, data: res.rows[0] });
  });

  // ─── DELETE /chats/:id ───
  app.delete('/chats/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };

    // Prevent deleting HQ chat
    const chat = await pool.query(`SELECT type FROM chats WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (chat.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found' },
      });
      return;
    }
    if (chat.rows[0].type === 'hq') {
      reply.status(400).send({
        success: false,
        error: { code: 'PROTECTED', message: 'Cannot delete the HQ chat' },
      });
      return;
    }

    await pool.query('DELETE FROM chats WHERE id = $1 AND organization_id = $2', [id, orgId]);
    logger.info('Chat deleted', { chat_id: id });
    reply.send({ success: true });
  });

  // ─── GET /chats/:id/members ───
  app.get('/chats/:id/members', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id } = request.params as { id: string };

    // Verify chat exists
    const chatCheck = await pool.query(`SELECT 1 FROM chats WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (chatCheck.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found' },
      });
      return;
    }

    const result = await pool.query(
      `SELECT cm.id, cm.user_id, cm.role, cm.joined_at, u.username, u.display_name
       FROM chat_members cm JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = $1 ORDER BY cm.joined_at`,
      [id],
    );
    reply.send({ success: true, data: result.rows });
  });

  // ─── POST /chats/:id/members ───
  app.post('/chats/:id/members', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: chatId } = request.params as { id: string };
    const bodyParsed = normalizeChatBody<{ user_id?: string; role?: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    if (!body.user_id) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'user_id is required' },
      });
      return;
    }

    // Verify chat and user exist
    const chatCheck = await pool.query(`SELECT 1 FROM chats WHERE id = $1 AND organization_id = $2`, [chatId, orgId]);
    if (chatCheck.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found' },
      });
      return;
    }
    const userCheck = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [orgId, body.user_id],
    );
    if (userCheck.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const role = body.role === 'admin' ? 'admin' : 'member';
    const memberId = uuidv7();

    try {
      await pool.query(
        `INSERT INTO chat_members (id, chat_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [memberId, chatId, body.user_id, role],
      );
    } catch (err: any) {
      if (err.code === '23505') {
        reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'User is already a member of this chat' },
        });
        return;
      }
      throw err;
    }

    logger.info('Member added to chat', { chat_id: chatId, user_id: body.user_id, role });
    reply.status(201).send({
      success: true,
      data: { id: memberId, chat_id: chatId, user_id: body.user_id, role },
    });
  });

  // ─── DELETE /chats/:chatId/members/:memberId ───
  app.delete('/chats/:chatId/members/:memberId', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { chatId, memberId } = request.params as { chatId: string; memberId: string };

    const res = await pool.query(
      `DELETE FROM chat_members cm
       USING chats c
       WHERE cm.id = $1 AND cm.chat_id = $2 AND c.id = cm.chat_id AND c.organization_id = $3
       RETURNING cm.id`,
      [memberId, chatId, orgId],
    );

    if (res.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Member not found in this chat' },
      });
      return;
    }

    logger.info('Member removed from chat', { chat_id: chatId, member_id: memberId });
    reply.send({ success: true });
  });

  // ─── GET /chats/:id/session-indexing ───
  app.get('/chats/:id/session-indexing', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: chatId } = request.params as { id: string };
    const chatCheck = await pool.query(`SELECT id FROM chats WHERE id = $1 AND organization_id = $2`, [chatId, orgId]);
    if (chatCheck.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }
    const enabled = await isSessionIndexingEnabled(pool, chatId);
    const consent = await getSessionIndexConsent(pool, chatId);
    const marker = await pool.query(
      `SELECT memory_last_indexed_at FROM session_settings WHERE session_id = $1 LIMIT 1`,
      [chatId],
    );
    reply.send({
      success: true,
      data: {
        enabled,
        consent,
        last_indexed_at: marker.rows[0]?.memory_last_indexed_at || null,
      },
    });
  });

  // ─── PUT /chats/:id/session-indexing ───
  app.put('/chats/:id/session-indexing', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: chatId } = request.params as { id: string };
    const body = (request.body || {}) as { consent?: boolean };
    if (typeof body.consent !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'consent boolean is required' },
      });
    }
    const chatCheck = await pool.query(`SELECT id FROM chats WHERE id = $1 AND organization_id = $2`, [chatId, orgId]);
    if (chatCheck.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }

    await pool.query(
      `INSERT INTO session_settings (session_id, memory_index_consent)
       VALUES ($1, $2)
       ON CONFLICT (session_id) DO UPDATE
       SET memory_index_consent = EXCLUDED.memory_index_consent`,
      [chatId, body.consent],
    );
    reply.send({ success: true, data: { chat_id: chatId, consent: body.consent } });
  });

  // ─── POST /chats/:id/index-session-memory ───
  app.post('/chats/:id/index-session-memory', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { id: chatId } = request.params as { id: string };
    const chatCheck = await pool.query(`SELECT id FROM chats WHERE id = $1 AND organization_id = $2`, [chatId, orgId]);
    if (chatCheck.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }
    const result = await indexSessionTranscriptIntoMemory(pool, chatId);
    reply.send({ success: true, data: result });
  });
}
