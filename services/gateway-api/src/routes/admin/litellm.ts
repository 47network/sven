import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { encryptLiteLlmVirtualKey } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function getLiteLlmTargetValidationError(
  err: unknown
): { code: 'VALIDATION'; message: string } | null {
  const pgCode = String((err as { code?: string })?.code || '');
  const constraint = String((err as { constraint?: string })?.constraint || '').toLowerCase();
  if (pgCode === '23514') {
    if (constraint.includes('target') || constraint.includes('single_target')) {
      return { code: 'VALIDATION', message: 'exactly one of user_id or agent_id must be set' };
    }
    return { code: 'VALIDATION', message: 'invalid key target state' };
  }
  if (pgCode !== '23503') return null;
  if (constraint.includes('user_id')) {
    return { code: 'VALIDATION', message: 'user_id does not reference an existing user' };
  }
  if (constraint.includes('agent_id')) {
    return { code: 'VALIDATION', message: 'agent_id does not reference an existing agent' };
  }
  return { code: 'VALIDATION', message: 'user_id or agent_id is invalid' };
}

const LITELLM_MAX_DAILY_BUDGET_USD_MAX = 9999999999.99;

function parseMaxDailyBudgetUsd(raw: unknown): { ok: true; value: number | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  const budgetStr = typeof raw === 'string' ? raw.trim() : String(raw);
  if (!budgetStr) {
    return { ok: false, message: 'max_daily_budget_usd must be a non-negative decimal with up to 2 fraction digits' };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(budgetStr)) {
    return { ok: false, message: 'max_daily_budget_usd must be a non-negative decimal with up to 2 fraction digits' };
  }

  const parsed = Number(budgetStr);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: 'max_daily_budget_usd must be a finite value' };
  }
  if (parsed < 0) {
    return { ok: false, message: 'max_daily_budget_usd must be greater than or equal to 0' };
  }
  if (parsed > LITELLM_MAX_DAILY_BUDGET_USD_MAX) {
    return {
      ok: false,
      message: `max_daily_budget_usd must be less than or equal to ${LITELLM_MAX_DAILY_BUDGET_USD_MAX}`,
    };
  }

  return { ok: true, value: parsed };
}

function getPagination(query: { page?: string; per_page?: string }, maxPerPage = 100) {
  return parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage });
}

function normalizeLiteLlmBody<T extends object>(
  body: unknown,
): { ok: true; value: Partial<T> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as Partial<T> };
}

export async function registerLiteLLMRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  async function ensureUserInOrg(userId: string, orgId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1
         AND user_id = $2
         AND status = 'active'
       LIMIT 1`,
      [orgId, userId],
    );
    return result.rows.length > 0;
  }

  async function ensureAgentInOrg(agentId: string, orgId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT asn.agent_id
       FROM agent_sessions asn
       JOIN chats c ON c.id = asn.session_id
       WHERE asn.agent_id = $1
         AND c.organization_id = $2
       LIMIT 1`,
      [agentId, orgId],
    );
    return result.rows.length > 0;
  }

  app.get('/litellm/keys', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const query = request.query as { user_id?: string; agent_id?: string; page?: string; per_page?: string };
    const pagination = getPagination(query, 200);
    if (!pagination.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: pagination.message },
      });
    }
    const { page, perPage, offset } = pagination;

    let where = 'WHERE organization_id = $1';
    const params: unknown[] = [orgId];
    if (query.user_id) {
      params.push(query.user_id);
      where += ` AND user_id = $${params.length}`;
    }
    if (query.agent_id) {
      params.push(query.agent_id);
      where += ` AND agent_id = $${params.length}`;
    }

    try {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM litellm_virtual_keys ${where}`,
        params,
      );
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, user_id, agent_id, key_alias, max_daily_budget_usd, last_used_at, created_at,
                COALESCE(key_last4, RIGHT(virtual_key, 4)) AS key_last4
         FROM litellm_virtual_keys ${where}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      reply.send({
        success: true,
        data: result.rows.map((row) => ({
          ...row,
          has_key: true,
        })),
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        reply.send({
          success: true,
          data: [],
          degraded: true,
          meta: { page, per_page: perPage, total: 0, total_pages: 0 },
        });
        return;
      }
      throw err;
    }
  });

  app.post('/litellm/keys', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const parsedBody = normalizeLiteLlmBody<{
      user_id?: string;
      agent_id?: string;
      key_alias?: string;
      virtual_key?: string;
      max_daily_budget_usd?: number;
    }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;

    if (!body.virtual_key || body.virtual_key.trim().length < 8) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'virtual_key is required' } });
      return;
    }
    if (!body.user_id && !body.agent_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'user_id or agent_id is required' } });
      return;
    }
    if (body.user_id && body.agent_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'user_id and agent_id are mutually exclusive' } });
      return;
    }
    if (body.user_id) {
      const userAllowed = await ensureUserInOrg(String(body.user_id), orgId);
      if (!userAllowed) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'user_id must belong to active organization' },
        });
        return;
      }
    }
    if (body.agent_id) {
      const agentAllowed = await ensureAgentInOrg(String(body.agent_id), orgId);
      if (!agentAllowed) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'agent_id must belong to active organization' },
        });
        return;
      }
    }
    const budget = parseMaxDailyBudgetUsd(body.max_daily_budget_usd);
    if (!budget.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: budget.message } });
      return;
    }

    const id = uuidv7();
    let encryptedVirtualKey: string;
    try {
      encryptedVirtualKey = encryptLiteLlmVirtualKey(body.virtual_key.trim());
    } catch (err) {
      reply.status(503).send({
        success: false,
        error: {
          code: 'CONFIG',
          message: err instanceof Error ? err.message : 'LiteLLM virtual key encryption is not configured',
        },
      });
      return;
    }
    const keyLast4 = body.virtual_key.trim().slice(-4);

    try {
      await pool.query(
        `INSERT INTO litellm_virtual_keys
          (id, organization_id, user_id, agent_id, key_alias, virtual_key, key_last4, max_daily_budget_usd, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          id,
          orgId,
          body.user_id || null,
          body.agent_id || null,
          body.key_alias || null,
          encryptedVirtualKey,
          keyLast4,
          budget.value,
        ],
      );
    } catch (err) {
      const validationErr = getLiteLlmTargetValidationError(err);
      if (validationErr) {
        reply.status(400).send({ success: false, error: validationErr });
        return;
      }
      throw err;
    }

    reply.status(201).send({
      success: true,
      data: { id },
    });
  });

  app.patch('/litellm/keys/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const parsedBody = normalizeLiteLlmBody<{
      user_id?: string;
      agent_id?: string;
      key_alias?: string;
      virtual_key?: string;
      max_daily_budget_usd?: number;
    }>(request.body);
    if (!parsedBody.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
      return;
    }
    const body = parsedBody.value;

    const sets: string[] = [];
    const params: unknown[] = [];
    const targetPatchRequested = body.user_id !== undefined || body.agent_id !== undefined;

    let currentTarget: { user_id: string | null; agent_id: string | null } | null = null;
    if (targetPatchRequested) {
      const currentRes = await pool.query(
        `SELECT user_id, agent_id
         FROM litellm_virtual_keys
         WHERE id = $1 AND organization_id = $2
         LIMIT 1`,
        [id, orgId],
      );
      if (currentRes.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
        return;
      }
      currentTarget = {
        user_id: currentRes.rows[0].user_id ?? null,
        agent_id: currentRes.rows[0].agent_id ?? null,
      };
      const nextUserId = body.user_id !== undefined ? (body.user_id || null) : currentTarget.user_id;
      const nextAgentId = body.agent_id !== undefined ? (body.agent_id || null) : currentTarget.agent_id;
      const hasUser = Boolean(nextUserId);
      const hasAgent = Boolean(nextAgentId);
      if (hasUser === hasAgent) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'exactly one of user_id or agent_id must be set' },
        });
        return;
      }
      if (hasUser) {
        const userAllowed = await ensureUserInOrg(String(nextUserId), orgId);
        if (!userAllowed) {
          reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'user_id must belong to active organization' },
          });
          return;
        }
      }
      if (hasAgent) {
        const agentAllowed = await ensureAgentInOrg(String(nextAgentId), orgId);
        if (!agentAllowed) {
          reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'agent_id must belong to active organization' },
          });
          return;
        }
      }
    }

    if (body.user_id !== undefined) {
      params.push(body.user_id || null);
      sets.push(`user_id = $${params.length}`);
    }
    if (body.agent_id !== undefined) {
      params.push(body.agent_id || null);
      sets.push(`agent_id = $${params.length}`);
    }
    if (body.key_alias !== undefined) {
      params.push(body.key_alias || null);
      sets.push(`key_alias = $${params.length}`);
    }
    if (body.virtual_key !== undefined) {
      if (!body.virtual_key || body.virtual_key.trim().length < 8) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'virtual_key must be at least 8 characters' } });
        return;
      }
      let encryptedVirtualKey: string;
      try {
        encryptedVirtualKey = encryptLiteLlmVirtualKey(body.virtual_key.trim());
      } catch (err) {
        reply.status(503).send({
          success: false,
          error: {
            code: 'CONFIG',
            message: err instanceof Error ? err.message : 'LiteLLM virtual key encryption is not configured',
          },
        });
        return;
      }
      params.push(encryptedVirtualKey);
      sets.push(`virtual_key = $${params.length}`);
      params.push(body.virtual_key.trim().slice(-4));
      sets.push(`key_last4 = $${params.length}`);
    }
    if (body.max_daily_budget_usd !== undefined) {
      const budget = parseMaxDailyBudgetUsd(body.max_daily_budget_usd);
      if (!budget.ok) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: budget.message } });
        return;
      }
      params.push(budget.value);
      sets.push(`max_daily_budget_usd = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id, orgId);
    let res: { rows: Array<{ id: string }> };
    try {
      res = await pool.query(
        `UPDATE litellm_virtual_keys SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length - 1} AND organization_id = $${params.length}
         RETURNING id`,
        params,
      );
    } catch (err) {
      const validationErr = getLiteLlmTargetValidationError(err);
      if (validationErr) {
        reply.status(400).send({ success: false, error: validationErr });
        return;
      }
      throw err;
    }

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/litellm/keys/:id', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const res = await pool.query(
      `DELETE FROM litellm_virtual_keys WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
      return;
    }
    reply.send({ success: true });
  });
}
