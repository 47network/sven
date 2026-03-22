import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { createMemoryAdapter } from '../../services/MemoryStore.js';
import { parsePaginationQuery } from './pagination.js';

const logger = createLogger('admin-memory');

const VALID_VISIBILITY = ['user_private', 'chat_shared', 'global'] as const;
const VALID_SCOPE = ['global', 'chat', 'project'] as const;

function parseBool(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return defaultValue;
}

function parseNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return defaultValue;
}

function parseDecayCurve(value: unknown): 'linear' | 'exponential' | 'step' {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'linear' || raw === 'step') return raw;
  return 'exponential';
}

async function loadSetting(pool: pg.Pool, orgId: string | null, key: string): Promise<unknown> {
  if (orgId) {
    const orgRes = await pool.query(
      `SELECT value FROM organization_settings WHERE organization_id = $1 AND key = $2`,
      [orgId, key],
    );
    if (orgRes.rows.length > 0) return orgRes.rows[0].value;
  }
  const globalRes = await pool.query(
    `SELECT value FROM settings_global WHERE key = $1`,
    [key],
  );
  if (globalRes.rows.length > 0) return globalRes.rows[0].value;
  return undefined;
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

function toCsvCell(value: unknown): string {
  if (value == null) return '';
  let raw = typeof value === 'string'
    ? value
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  raw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalized = raw.replace(/^(\s*)([=+\-@])/, "$1'$2");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function normalizeMemoryBody<T extends object>(
  body: unknown,
): { ok: true; value: Partial<T> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as Partial<T> };
}

export async function registerMemoryRoutes(app: FastifyInstance, pool: pg.Pool) {
  const memoryStore = createMemoryAdapter(pool);

  function requireOrgId(request: any, reply: any): string | null {
    const orgId = request.orgId ? String(request.orgId) : null;
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return null;
    }
    return orgId;
  }

  async function validateUserInOrg(orgId: string, userId: string): Promise<boolean> {
    const res = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1
         AND user_id = $2
         AND status = 'active'
       LIMIT 1`,
      [orgId, userId],
    );
    return res.rows.length > 0;
  }

  async function validateChatInOrg(orgId: string, chatId: string): Promise<boolean> {
    const res = await pool.query(
      `SELECT 1
       FROM chats
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1`,
      [chatId, orgId],
    );
    return res.rows.length > 0;
  }
  // ─── Identity Docs ──────────────────────────────────────────────────────
  app.get('/identity-docs', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return;
    }

    const query = request.query as {
      scope?: string;
      chat_id?: string;
      project_key?: string;
      page?: string;
      per_page?: string;
    };
    const pagination = getPaginationOrReply(reply, query, 100);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];

    if (query.scope) {
      params.push(query.scope);
      where += ` AND scope = $${params.length}`;
    }
    if (query.chat_id) {
      params.push(query.chat_id);
      where += ` AND chat_id = $${params.length}`;
    }
    if (query.project_key) {
      params.push(query.project_key);
      where += ` AND project_key = $${params.length}`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM sven_identity_docs ${where}`, params);
    const total = countRes.rows[0].total;

    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, scope, chat_id, project_key, content, version, updated_by, updated_at
       FROM sven_identity_docs ${where}
       ORDER BY updated_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  app.get('/identity-docs/:id', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return;
    }

    const { id } = request.params as { id: string };
    const res = await pool.query(
      `SELECT id, scope, chat_id, project_key, content, version, updated_by, updated_at
       FROM sven_identity_docs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Identity doc not found' } });
      return;
    }
    reply.send({ success: true, data: res.rows[0] });
  });

  app.post('/identity-docs', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return;
    }

    const parsedBody = normalizeMemoryBody<{
      scope?: string;
      chat_id?: string;
      project_key?: string;
      content?: string;
    }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;

    if (!body.scope || !VALID_SCOPE.includes(body.scope as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `scope must be one of: ${VALID_SCOPE.join(', ')}` } });
      return;
    }
    if (body.scope === 'chat' && !body.chat_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'chat_id is required for chat scope' } });
      return;
    }
    if (body.scope === 'project' && !String(body.project_key || '').trim()) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'project_key is required for project scope' } });
      return;
    }
    if (body.scope !== 'chat' && body.chat_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'chat_id is only valid for chat scope' } });
      return;
    }
    if (body.scope !== 'project' && body.project_key) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'project_key is only valid for project scope' } });
      return;
    }
    if (!body.content || body.content.trim().length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content is required' } });
      return;
    }

    const scope = body.scope;
    const chatId = body.scope === 'chat' ? body.chat_id : null;
    const projectKey = body.scope === 'project' ? String(body.project_key || '').trim().toLowerCase() : null;

    if (scope === 'chat' && chatId) {
      const chatRes = await pool.query(
        `SELECT id FROM chats WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [chatId, orgId],
      );
      if (chatRes.rows.length === 0) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Chat is not in active organization' } });
        return;
      }
    }

    const existing = await pool.query(
      `SELECT id, version FROM sven_identity_docs
       WHERE organization_id = $1
         AND scope = $2
         AND (chat_id IS NOT DISTINCT FROM $3)
         AND (project_key IS NOT DISTINCT FROM $4)
       LIMIT 1`,
      [orgId, scope, chatId, projectKey],
    );

    if (existing.rows.length > 0) {
      const newVersion = existing.rows[0].version + 1;
      await pool.query(
        `UPDATE sven_identity_docs
         SET content = $1, version = $2, updated_by = $3, updated_at = NOW()
         WHERE id = $4 AND organization_id = $5`,
        [body.content, newVersion, (request as any).userId, existing.rows[0].id, orgId],
      );
      reply.send({ success: true, data: { id: existing.rows[0].id, version: newVersion } });
      return;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO sven_identity_docs (id, organization_id, scope, chat_id, project_key, content, version, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [id, orgId, scope, chatId, projectKey, body.content, 1, (request as any).userId],
    );

    logger.info('Identity doc created', { id, organization_id: orgId, scope, chat_id: chatId, project_key: projectKey });
    reply.status(201).send({ success: true, data: { id, version: 1 } });
  });

  app.delete('/identity-docs/:id', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return;
    }

    const { id } = request.params as { id: string };
    const res = await pool.query(
      'DELETE FROM sven_identity_docs WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Identity doc not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Memories ───────────────────────────────────────────────────────────
  app.get('/memories', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const query = request.query as {
      visibility?: string;
      user_id?: string;
      chat_id?: string;
      key?: string;
      source?: string;
      search?: string;
      exact?: string;
      sort_by?: string;
      sort_dir?: string;
      page?: string;
      per_page?: string;
      include_archived?: string;
    };
    const pagination = getPaginationOrReply(reply, query, 200);
    if (!pagination) return;
    const { page, perPage, offset } = pagination;
    const params: unknown[] = [orgId];
    let where = 'WHERE organization_id = $1';
    if (query.visibility) {
      params.push(query.visibility);
      where += ` AND visibility = $${params.length}`;
    }
    if (query.user_id) {
      const inOrg = await validateUserInOrg(orgId, query.user_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'user_id is not in active organization' } });
        return;
      }
      params.push(query.user_id);
      where += ` AND user_id = $${params.length}`;
    }
    if (query.chat_id) {
      const inOrg = await validateChatInOrg(orgId, query.chat_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'chat_id is not in active organization' } });
        return;
      }
      params.push(query.chat_id);
      where += ` AND chat_id = $${params.length}`;
    }
    if (query.source) {
      params.push(query.source);
      where += ` AND source = $${params.length}`;
    }
    if (query.key) {
      params.push(`%${query.key}%`);
      where += ` AND key ILIKE $${params.length}`;
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      where += ` AND (key ILIKE $${params.length} OR value ILIKE $${params.length})`;
    }
    if (query.exact) {
      params.push(query.exact);
      where += ` AND (key = $${params.length} OR value = $${params.length})`;
    }
    const includeArchived = parseBool(query.include_archived, false);
    if (!includeArchived) {
      where += ` AND archived_at IS NULL`;
    }

    const sortBy = String(query.sort_by || 'updated_at').toLowerCase();
    const sortDir = String(query.sort_dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortColumn =
      sortBy === 'created_at' ? 'created_at'
        : sortBy === 'importance' ? 'importance'
          : sortBy === 'visibility' ? 'visibility'
            : sortBy === 'source' ? 'source'
              : 'updated_at';

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM memories ${where}`, params);
    const total = Number(countRes.rows[0]?.total || 0);
    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, user_id, chat_id, visibility, key, value, source, importance,
              evidence, archived_at, merged_into, access_count, last_accessed_at, created_at, updated_at
       FROM memories ${where}
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  app.post('/memories', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const parsedBody = normalizeMemoryBody<{
      user_id?: string;
      chat_id?: string;
      visibility?: string;
      key?: string;
      value?: string;
      source?: string;
    }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;

    if (!body.visibility || !VALID_VISIBILITY.includes(body.visibility as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `visibility must be one of: ${VALID_VISIBILITY.join(', ')}` } });
      return;
    }
    if (!body.key || !body.value) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'key and value are required' } });
      return;
    }

    if (body.visibility === 'user_private' && !body.user_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'user_id is required for user_private memories' } });
      return;
    }
    if (body.visibility === 'chat_shared' && !body.chat_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'chat_id is required for chat_shared memories' } });
      return;
    }

    if (body.user_id) {
      const inOrg = await validateUserInOrg(orgId, body.user_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'user_id is not in active organization' } });
        return;
      }
    }
    if (body.chat_id) {
      const inOrg = await validateChatInOrg(orgId, body.chat_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'chat_id is not in active organization' } });
        return;
      }
    }

    const id = await memoryStore.create({
      user_id: body.user_id || null,
      organization_id: orgId,
      chat_id: body.chat_id || null,
      visibility: body.visibility as any,
      key: body.key,
      value: body.value,
      source: body.source || 'manual',
    });

    reply.status(201).send({ success: true, data: { id } });
  });

  const updateMemoryHandler = async (request: any, reply: any) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const { id } = request.params as { id: string };
    const parsedBody = normalizeMemoryBody<{ visibility?: string; key?: string; value?: string; importance?: unknown }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;

    if (
      body.visibility === undefined &&
      body.key === undefined &&
      body.value === undefined &&
      body.importance === undefined
    ) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    if (body.visibility !== undefined && !VALID_VISIBILITY.includes(body.visibility as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `visibility must be one of: ${VALID_VISIBILITY.join(', ')}` } });
      return;
    }
    if (body.key !== undefined && body.key.trim().length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'key cannot be empty' } });
      return;
    }
    if (body.value !== undefined && body.value.trim().length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'value cannot be empty' } });
      return;
    }

    const updated = await memoryStore.update(id, {
      visibility: body.visibility as any,
      key: body.key,
      value: body.value,
      importance: body.importance !== undefined ? Number(body.importance) : undefined,
    }, {
      organization_id: orgId,
    });

    if (!updated) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Memory not found' } });
      return;
    }

    reply.send({ success: true, data: updated });
  };
  app.patch('/memories/:id', updateMemoryHandler);
  app.put('/memories/:id', updateMemoryHandler);

  app.delete('/memories/:id', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const { id } = request.params as { id: string };
    const removed = await memoryStore.delete(id, {
      organization_id: orgId,
    });
    if (!removed) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Memory not found' } });
      return;
    }
    reply.send({ success: true });
  });

  app.post('/memories/search', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const body = (request.body as {
      query?: string;
      user_id?: string;
      chat_id?: string;
      visibility?: string;
      source?: string;
      top_k?: number;
      temporal_decay?: boolean;
      decay_factor?: number;
      decay_curve?: 'linear' | 'exponential' | 'step';
      decay_step_days?: number;
      mmr?: boolean;
      mmr_lambda?: number;
    }) || {};
    const query = String(body.query || '').trim();
    if (!query) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'query is required' } });
      return;
    }
    const temporalEnabled = body.temporal_decay !== undefined
      ? body.temporal_decay
      : parseBool(await loadSetting(pool, orgId, 'memory.temporalDecay.enabled'), true);
    const decayFactor = body.decay_factor !== undefined
      ? Number(body.decay_factor)
      : parseNumber(await loadSetting(pool, orgId, 'memory.temporalDecay.factor'), 0.98);
    const decayCurve = body.decay_curve !== undefined
      ? parseDecayCurve(body.decay_curve)
      : parseDecayCurve(await loadSetting(pool, orgId, 'memory.temporalDecay.curve'));
    const decayStepDays = body.decay_step_days !== undefined
      ? Math.max(1, Math.floor(Number(body.decay_step_days)))
      : Math.max(1, Math.floor(parseNumber(await loadSetting(pool, orgId, 'memory.temporalDecay.stepDays'), 7)));
    const mmrEnabled = body.mmr !== undefined
      ? body.mmr
      : parseBool(await loadSetting(pool, orgId, 'memory.mmr.enabled'), true);
    const mmrLambda = body.mmr_lambda !== undefined
      ? Number(body.mmr_lambda)
      : parseNumber(await loadSetting(pool, orgId, 'memory.mmr.lambda'), 0.7);

    if (body.user_id) {
      const inOrg = await validateUserInOrg(orgId, body.user_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'user_id is not in active organization' } });
        return;
      }
    }
    if (body.chat_id) {
      const inOrg = await validateChatInOrg(orgId, body.chat_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'chat_id is not in active organization' } });
        return;
      }
    }

    const rows = await memoryStore.search({
      query,
      organization_id: orgId,
      user_id: body.user_id,
      chat_id: body.chat_id,
      visibility: body.visibility as any,
      source: body.source,
      top_k: body.top_k,
      temporal_decay: temporalEnabled,
      decay_factor: decayFactor,
      decay_curve: decayCurve,
      decay_step_days: decayStepDays,
      mmr: mmrEnabled,
      mmr_lambda: mmrLambda,
    });
    reply.send({ success: true, data: rows });
  });

  app.post('/memories/consolidate', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const body = (request.body as { user_id?: string; chat_id?: string }) || {};
    if (body.user_id) {
      const inOrg = await validateUserInOrg(orgId, body.user_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'user_id is not in active organization' } });
        return;
      }
    }
    if (body.chat_id) {
      const inOrg = await validateChatInOrg(orgId, body.chat_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'chat_id is not in active organization' } });
        return;
      }
    }

    const result = await memoryStore.consolidate({
      organization_id: orgId,
      user_id: body.user_id,
      chat_id: body.chat_id,
    });
    reply.send({ success: true, data: result });
  });

  app.post('/memories/decay', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const body = (request.body as { half_life_days?: number; floor?: number }) || {};
    const result = await memoryStore.decay({
      organization_id: orgId,
      half_life_days: body.half_life_days,
      floor: body.floor,
    });
    reply.send({ success: true, data: result });
  });

  app.post('/memories/extract', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const body = (request.body as {
      chat_id?: string;
      user_id?: string;
      text?: string;
      visibility?: string;
    }) || {};
    const text = String(body.text || '').trim();
    if (!text) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text is required' } });
      return;
    }

    const extracted: Array<{ key: string; value: string }> = [];
    const normalized = text.replace(/\s+/g, ' ').trim();
    const mName = normalized.match(/\bmy name is ([a-z0-9 _-]{2,60})/i);
    const mLike = normalized.match(/\bI (?:really )?(?:like|love|prefer) ([a-z0-9 _-]{2,100})/i);
    const mTimezone = normalized.match(/\bmy timezone is ([a-z0-9_/+-]{2,80})/i);
    const mRemember = normalized.match(/\bremember(?: that)?[: ]+(.{3,180})/i);
    if (mName) extracted.push({ key: 'profile.name', value: mName[1].trim() });
    if (mLike) extracted.push({ key: 'preference.general', value: mLike[1].trim() });
    if (mTimezone) extracted.push({ key: 'profile.timezone', value: mTimezone[1].trim() });
    if (mRemember) extracted.push({ key: `memory.note.${Date.now()}`, value: mRemember[1].trim() });
    if (extracted.length === 0) {
      reply.send({ success: true, data: { extracted: 0, ids: [] } });
      return;
    }

    const visibility = (body.visibility as any) || (body.user_id ? 'user_private' : body.chat_id ? 'chat_shared' : 'global');
    if (body.user_id) {
      const inOrg = await validateUserInOrg(orgId, body.user_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'user_id is not in active organization' } });
        return;
      }
    }
    if (body.chat_id) {
      const inOrg = await validateChatInOrg(orgId, body.chat_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'chat_id is not in active organization' } });
        return;
      }
    }

    const ids: string[] = [];
    for (const item of extracted) {
      const id = await memoryStore.create({
        user_id: body.user_id || null,
        organization_id: orgId,
        chat_id: body.chat_id || null,
        visibility,
        key: item.key,
        value: item.value,
        source: 'auto_extract',
        importance: 1.15,
      });
      ids.push(id);
    }
    reply.send({ success: true, data: { extracted: ids.length, ids } });
  });

  // ─── GET /memories/:id — single memory detail ────────────────────────
  app.get('/memories/:id', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const { id } = request.params as { id: string };
    const res = await pool.query(
      `SELECT id, user_id, chat_id, visibility, key, value, source, importance,
              evidence, archived_at, merged_into, access_count, last_accessed_at, created_at, updated_at
       FROM memories WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Memory not found' } });
      return;
    }
    reply.send({ success: true, data: res.rows[0] });
  });

  // ─── DELETE /memories/bulk — bulk delete by array of IDs ──────────────
  app.delete('/memories/bulk', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const parsedBody = normalizeMemoryBody<{ ids?: string[] }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'ids must be a non-empty array' } });
      return;
    }
    if (body.ids.length > 500) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Maximum 500 IDs per bulk delete' } });
      return;
    }
    const res = await pool.query(
      `DELETE FROM memories WHERE id = ANY($1::text[]) AND organization_id = $2 RETURNING id`,
      [body.ids, orgId],
    );
    reply.send({ success: true, data: { deleted: res.rows.length } });
  });

  // ─── GET /memories/export — export memories as JSON ───────────────────
  app.get('/memories/export', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const query = request.query as { visibility?: string; user_id?: string; chat_id?: string; format?: string };
    const format = String(query.format || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'format must be json or csv' } });
      return;
    }

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.visibility) { params.push(query.visibility); where += ` AND visibility = $${params.length}`; }
    if (query.user_id) {
      const inOrg = await validateUserInOrg(orgId, query.user_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'user_id is not in active organization' } });
        return;
      }
      params.push(query.user_id);
      where += ` AND user_id = $${params.length}`;
    }
    if (query.chat_id) {
      const inOrg = await validateChatInOrg(orgId, query.chat_id);
      if (!inOrg) {
        reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'chat_id is not in active organization' } });
        return;
      }
      params.push(query.chat_id);
      where += ` AND chat_id = $${params.length}`;
    }

    const res = await pool.query(
      `SELECT id, user_id, chat_id, visibility, key, value, source, importance,
              evidence, archived_at, merged_into, access_count, last_accessed_at, created_at, updated_at
       FROM memories ${where}
       ORDER BY created_at DESC
       LIMIT 10000`,
      params,
    );

    if (format === 'csv') {
      const header = 'id,user_id,chat_id,visibility,key,value,source,importance,access_count,created_at,updated_at';
      const csvRows = res.rows.map((r: any) => {
        return [
          toCsvCell(r.id),
          toCsvCell(r.user_id),
          toCsvCell(r.chat_id),
          toCsvCell(r.visibility),
          toCsvCell(r.key),
          toCsvCell(r.value),
          toCsvCell(r.source),
          toCsvCell(r.importance),
          toCsvCell(r.access_count),
          toCsvCell(r.created_at),
          toCsvCell(r.updated_at),
        ].join(',');
      });
      reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="memories-export.csv"');
      reply.send([header, ...csvRows].join('\n'));
      return;
    }

    reply.header('Content-Type', 'application/json').header('Content-Disposition', 'attachment; filename="memories-export.json"');
    reply.send({ exported_at: new Date().toISOString(), count: res.rows.length, memories: res.rows });
  });

  // ─── POST /memories/import — import memories from JSON ────────────────
  app.post('/memories/import', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const parsedBody = normalizeMemoryBody<{ memories?: Array<{ user_id?: string; chat_id?: string; visibility?: string; key?: string; value?: string; source?: string; importance?: number }> }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;
    if (!Array.isArray(body.memories) || body.memories.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'memories must be a non-empty array' } });
      return;
    }
    if (body.memories.length > 1000) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Maximum 1000 memories per import' } });
      return;
    }

    let imported = 0;
    let skipped = 0;
    for (const mem of body.memories) {
      if (!mem.key || !mem.value || !mem.visibility) { skipped++; continue; }
      if (!VALID_VISIBILITY.includes(mem.visibility as any)) { skipped++; continue; }
      try {
        if (mem.user_id) {
          const inOrg = await validateUserInOrg(orgId, mem.user_id);
          if (!inOrg) { skipped++; continue; }
        }
        if (mem.chat_id) {
          const inOrg = await validateChatInOrg(orgId, mem.chat_id);
          if (!inOrg) { skipped++; continue; }
        }
        await memoryStore.create({
          user_id: mem.user_id || null,
          organization_id: orgId,
          chat_id: mem.chat_id || null,
          visibility: mem.visibility as any,
          key: mem.key,
          value: mem.value,
          source: mem.source || 'import',
          importance: mem.importance ?? 1.0,
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    reply.send({ success: true, data: { imported, skipped, total: body.memories.length } });
  });

  // ─── GET /memories/stats — memory statistics ──────────────────────────
  app.get('/memories/stats', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const [byVis, bySource, total, oldest, newest, topAccessed, storageByVisibility, ageDistribution, growthOverTime] = await Promise.all([
      pool.query(`SELECT visibility, COUNT(*)::int AS count FROM memories WHERE organization_id = $1 GROUP BY visibility ORDER BY count DESC`, [orgId]),
      pool.query(`SELECT source, COUNT(*)::int AS count FROM memories WHERE organization_id = $1 GROUP BY source ORDER BY count DESC`, [orgId]),
      pool.query(`SELECT COUNT(*)::int AS total, AVG(importance)::float8 AS avg_importance, SUM(access_count)::int AS total_accesses FROM memories WHERE organization_id = $1`, [orgId]),
      pool.query(`SELECT MIN(created_at) AS oldest FROM memories WHERE organization_id = $1`, [orgId]),
      pool.query(`SELECT MAX(created_at) AS newest FROM memories WHERE organization_id = $1`, [orgId]),
      pool.query(`SELECT id, key, value, access_count FROM memories WHERE organization_id = $1 ORDER BY access_count DESC LIMIT 10`, [orgId]),
      pool.query(
        `SELECT visibility,
                SUM(octet_length(COALESCE(key, '')) + octet_length(COALESCE(value, '')))::bigint AS bytes
         FROM memories
         WHERE organization_id = $1
         GROUP BY visibility
         ORDER BY bytes DESC`,
        [orgId],
      ),
      pool.query(
        `SELECT bucket, COUNT(*)::int AS count
         FROM (
           SELECT CASE
             WHEN created_at >= NOW() - INTERVAL '1 day' THEN '0-1d'
             WHEN created_at >= NOW() - INTERVAL '7 days' THEN '2-7d'
             WHEN created_at >= NOW() - INTERVAL '30 days' THEN '8-30d'
             WHEN created_at >= NOW() - INTERVAL '90 days' THEN '31-90d'
             ELSE '90d+'
           END AS bucket
           FROM memories
           WHERE organization_id = $1
         ) x
         GROUP BY bucket
         ORDER BY bucket`,
        [orgId],
      ),
      pool.query(
        `SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
         FROM memories
         WHERE organization_id = $1
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1
         ORDER BY 1 ASC`,
        [orgId],
      ),
    ]);

    reply.send({
      success: true,
      data: {
        total: total.rows[0]?.total ?? 0,
        avg_importance: total.rows[0]?.avg_importance ?? 0,
        total_accesses: total.rows[0]?.total_accesses ?? 0,
        oldest_memory: oldest.rows[0]?.oldest ?? null,
        newest_memory: newest.rows[0]?.newest ?? null,
        by_visibility: byVis.rows,
        by_source: bySource.rows,
        top_accessed: topAccessed.rows,
        storage_by_visibility: storageByVisibility.rows,
        age_distribution: ageDistribution.rows,
        growth_over_time: growthOverTime.rows,
      },
    });
  });
}
