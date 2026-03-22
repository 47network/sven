import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';

const logger = createLogger('admin-models');

const VALID_POLICY_SCOPES = ['global', 'chat', 'user'] as const;
const VALID_ROLLOUT_STRATEGIES = ['canary', 'blue_green', 'rolling'] as const;
const VALID_ROLLOUT_STATUS = ['pending', 'active', 'completed', 'rolled_back'] as const;

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function getPagination(query: { page?: string; per_page?: string }, maxPerPage = 100) {
  return parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage });
}

function normalizeModelsBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

function sendModelsSchemaUnavailable(reply: any, surface: string) {
  reply.status(503).send({
    success: false,
    error: {
      code: 'FEATURE_UNAVAILABLE',
      message: `Model ${surface} not initialized`,
    },
  });
}

export async function registerModelRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }

  // ─── Model Registry ────────────────────────────────────────────────────
  app.get('/models/registry', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const query = request.query as { provider?: string; is_local?: string; page?: string; per_page?: string };
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

    if (query.provider) {
      params.push(query.provider);
      where += ` AND provider = $${params.length}`;
    }
    if (query.is_local) {
      params.push(query.is_local === 'true');
      where += ` AND is_local = $${params.length}`;
    }

    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM model_registry ${where}`, params);
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, name, provider, model_id, endpoint, capabilities, is_local, cost_per_1k_tokens, created_at
         FROM model_registry ${where}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      reply.send({
        success: true,
        data: result.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendModelsSchemaUnavailable(reply, 'registry');
        return;
      }
      throw err;
    }
  });

  // Backward-compat aliases used by admin UI.
  app.get('/models', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    try {
      const res = await pool.query(
        `SELECT id, name, provider, model_id, endpoint, capabilities, is_local, cost_per_1k_tokens, created_at
         FROM model_registry
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [orgId],
      );
      reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendModelsSchemaUnavailable(reply, 'registry');
        return;
      }
      throw err;
    }
  });

  app.post('/models/registry', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const bodyParsed = normalizeModelsBody<{
      name?: string;
      provider?: string;
      model_id?: string;
      endpoint?: string;
      capabilities?: string[];
      is_local?: boolean;
      cost_per_1k_tokens?: number;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.name || !body.provider || !body.model_id || !body.endpoint) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name, provider, model_id, and endpoint are required' } });
      return;
    }

    const id = uuidv7();
    try {
    await pool.query(
      `INSERT INTO model_registry (id, organization_id, name, provider, model_id, endpoint, capabilities, is_local, cost_per_1k_tokens, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        id,
        orgId,
        body.name.trim(),
        body.provider.trim(),
        body.model_id.trim(),
        body.endpoint.trim(),
        body.capabilities || [],
        Boolean(body.is_local),
        body.cost_per_1k_tokens ?? null,
      ],
    );
    } catch (err: any) {
      if (err.code === '23505') {
        reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Model already exists for provider/model_id' } });
        return;
      }
      throw err;
    }

    logger.info('Model registry entry created', { id, name: body.name, provider: body.provider });
    reply.status(201).send({ success: true, data: { id } });
  });

  app.post('/models', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const bodyParsed = normalizeModelsBody<{
      name?: string;
      provider?: string;
      model_id?: string;
      endpoint?: string;
      capabilities?: string[];
      is_local?: boolean;
      cost_per_1k_tokens?: number;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    if (!body.name || !body.provider || !body.model_id || !body.endpoint) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name, provider, model_id, and endpoint are required' } });
      return;
    }
    try {
      const id = uuidv7();
      await pool.query(
        `INSERT INTO model_registry (id, organization_id, name, provider, model_id, endpoint, capabilities, is_local, cost_per_1k_tokens, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [id, orgId, body.name.trim(), body.provider.trim(), body.model_id.trim(), body.endpoint.trim(), body.capabilities || [], Boolean(body.is_local), body.cost_per_1k_tokens ?? null],
      );
      reply.status(201).send({ success: true, data: { id } });
    } catch (err: any) {
      if (err?.code === '23505') {
        reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Model already exists for provider/model_id' } });
        return;
      }
      if (isSchemaCompatError(err)) {
        reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Model registry not initialized' } });
        return;
      }
      throw err;
    }
  });

  app.patch('/models/registry/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeModelsBody<{
      name?: string;
      endpoint?: string;
      capabilities?: string[];
      is_local?: boolean;
      cost_per_1k_tokens?: number;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      params.push(body.name.trim());
      sets.push(`name = $${params.length}`);
    }
    if (body.endpoint !== undefined) {
      params.push(body.endpoint.trim());
      sets.push(`endpoint = $${params.length}`);
    }
    if (body.capabilities !== undefined) {
      params.push(body.capabilities);
      sets.push(`capabilities = $${params.length}`);
    }
    if (body.is_local !== undefined) {
      params.push(Boolean(body.is_local));
      sets.push(`is_local = $${params.length}`);
    }
    if (body.cost_per_1k_tokens !== undefined) {
      params.push(body.cost_per_1k_tokens);
      sets.push(`cost_per_1k_tokens = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id);
    params.push(orgId);
    const res = await pool.query(
      `UPDATE model_registry SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING id, name, provider, model_id, endpoint, capabilities, is_local, cost_per_1k_tokens, created_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.put('/models/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeModelsBody<{
      name?: string;
      endpoint?: string;
      capabilities?: string[];
      is_local?: boolean;
      cost_per_1k_tokens?: number;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.name !== undefined) {
      params.push(body.name.trim());
      sets.push(`name = $${params.length}`);
    }
    if (body.endpoint !== undefined) {
      params.push(body.endpoint.trim());
      sets.push(`endpoint = $${params.length}`);
    }
    if (body.capabilities !== undefined) {
      params.push(body.capabilities);
      sets.push(`capabilities = $${params.length}`);
    }
    if (body.is_local !== undefined) {
      params.push(Boolean(body.is_local));
      sets.push(`is_local = $${params.length}`);
    }
    if (body.cost_per_1k_tokens !== undefined) {
      params.push(body.cost_per_1k_tokens);
      sets.push(`cost_per_1k_tokens = $${params.length}`);
    }
    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }
    try {
      params.push(id, orgId);
      const res = await pool.query(
        `UPDATE model_registry SET ${sets.join(', ')}
         WHERE id = $${params.length - 1} AND organization_id = $${params.length}
         RETURNING id, name, provider, model_id, endpoint, capabilities, is_local, cost_per_1k_tokens, created_at`,
        params,
      );
      if (res.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
        return;
      }
      reply.send({ success: true, data: res.rows[0] });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Model registry not initialized' } });
        return;
      }
      throw err;
    }
  });

  app.delete('/models/registry/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM model_registry WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Model Policies ────────────────────────────────────────────────────
  app.get('/models/policies', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const query = request.query as { scope?: string; target_id?: string; model_id?: string; page?: string; per_page?: string };
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

    if (query.scope) {
      params.push(query.scope);
      where += ` AND scope = $${params.length}`;
    }
    if (query.target_id) {
      params.push(query.target_id);
      where += ` AND target_id = $${params.length}`;
    }
    if (query.model_id) {
      params.push(query.model_id);
      where += ` AND model_id = $${params.length}`;
    }

    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM model_policies ${where}`, params);
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, scope, target_id, model_id, priority, created_at
         FROM model_policies ${where}
         ORDER BY priority DESC, created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      reply.send({
        success: true,
        data: result.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendModelsSchemaUnavailable(reply, 'policies');
        return;
      }
      throw err;
    }
  });

  app.post('/models/policies', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const bodyParsed = normalizeModelsBody<{ scope?: string; target_id?: string; model_id?: string; priority?: number }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.scope || !VALID_POLICY_SCOPES.includes(body.scope as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `scope must be one of: ${VALID_POLICY_SCOPES.join(', ')}` } });
      return;
    }
    if (!body.model_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model_id is required' } });
      return;
    }
    if ((body.scope === 'chat' || body.scope === 'user') && !body.target_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target_id is required for chat/user scope' } });
      return;
    }

    const modelExists = await pool.query('SELECT 1 FROM model_registry WHERE id = $1 AND organization_id = $2', [body.model_id, orgId]);
    if (modelExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
      return;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO model_policies (id, organization_id, scope, target_id, model_id, priority, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, orgId, body.scope, body.target_id || null, body.model_id, body.priority ?? 0],
    );

    reply.status(201).send({ success: true, data: { id } });
  });

  app.patch('/models/policies/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeModelsBody<{ priority?: number; model_id?: string }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.priority !== undefined) {
      params.push(body.priority);
      sets.push(`priority = $${params.length}`);
    }
    if (body.model_id !== undefined) {
      const modelExists = await pool.query('SELECT 1 FROM model_registry WHERE id = $1 AND organization_id = $2', [body.model_id, orgId]);
      if (modelExists.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
        return;
      }
      params.push(body.model_id);
      sets.push(`model_id = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id);
    params.push(orgId);
    const res = await pool.query(
      `UPDATE model_policies SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING id, scope, target_id, model_id, priority, created_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/models/policies/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM model_policies WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Model Rollouts ────────────────────────────────────────────────────
  app.get('/models/rollouts', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const query = request.query as { model_id?: string; status?: string; page?: string; per_page?: string };
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

    if (query.model_id) {
      params.push(query.model_id);
      where += ` AND model_id = $${params.length}`;
    }
    if (query.status) {
      params.push(query.status);
      where += ` AND status = $${params.length}`;
    }

    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM model_rollouts ${where}`, params);
      const total = countRes.rows[0].total;

      const dataParams = [...params, perPage, offset];
      const result = await pool.query(
        `SELECT id, model_id, strategy, traffic_pct, status, metrics, created_at, updated_at
         FROM model_rollouts ${where}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      reply.send({
        success: true,
        data: result.rows,
        meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendModelsSchemaUnavailable(reply, 'rollouts');
        return;
      }
      throw err;
    }
  });

  app.post('/models/rollouts', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const bodyParsed = normalizeModelsBody<{
      model_id?: string;
      strategy?: string;
      traffic_pct?: number;
      status?: string;
      metrics?: Record<string, unknown>;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    if (!body.model_id) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model_id is required' } });
      return;
    }
    if (body.strategy && !VALID_ROLLOUT_STRATEGIES.includes(body.strategy as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `strategy must be one of: ${VALID_ROLLOUT_STRATEGIES.join(', ')}` } });
      return;
    }
    if (body.status && !VALID_ROLLOUT_STATUS.includes(body.status as any)) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `status must be one of: ${VALID_ROLLOUT_STATUS.join(', ')}` } });
      return;
    }
    if (body.traffic_pct !== undefined) {
      const parsedPct = Number(body.traffic_pct);
      if (!Number.isFinite(parsedPct)) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'traffic_pct must be a finite number between 0 and 100' } });
        return;
      }
    }

    const modelExists = await pool.query('SELECT 1 FROM model_registry WHERE id = $1 AND organization_id = $2', [body.model_id, orgId]);
    if (modelExists.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
      return;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO model_rollouts (id, organization_id, model_id, strategy, traffic_pct, status, metrics, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        id,
        orgId,
        body.model_id,
        body.strategy || 'canary',
        Math.min(Math.max(Number(body.traffic_pct ?? 0), 0), 100),
        body.status || 'pending',
        JSON.stringify(body.metrics || {}),
      ],
    );

    reply.status(201).send({ success: true, data: { id } });
  });

  app.patch('/models/rollouts/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeModelsBody<{ traffic_pct?: number; status?: string; metrics?: Record<string, unknown> }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.traffic_pct !== undefined) {
      const parsedPct = Number(body.traffic_pct);
      if (!Number.isFinite(parsedPct)) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'traffic_pct must be a finite number between 0 and 100' } });
        return;
      }
      const pct = Math.min(Math.max(parsedPct, 0), 100);
      params.push(pct);
      sets.push(`traffic_pct = $${params.length}`);
    }
    if (body.status !== undefined) {
      if (!VALID_ROLLOUT_STATUS.includes(body.status as any)) {
        reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `status must be one of: ${VALID_ROLLOUT_STATUS.join(', ')}` } });
        return;
      }
      params.push(body.status);
      sets.push(`status = $${params.length}`);
    }
    if (body.metrics !== undefined) {
      params.push(JSON.stringify(body.metrics));
      sets.push(`metrics = $${params.length}`);
    }

    if (sets.length === 0) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    params.push(id);
    params.push(orgId);
    const res = await pool.query(
      `UPDATE model_rollouts SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}
       RETURNING id, model_id, strategy, traffic_pct, status, metrics, created_at, updated_at`,
      params,
    );

    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rollout not found' } });
      return;
    }

    reply.send({ success: true, data: res.rows[0] });
  });

  app.delete('/models/rollouts/:id', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params as { id: string };
    const res = await pool.query('DELETE FROM model_rollouts WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    if (res.rows.length === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rollout not found' } });
      return;
    }
    reply.send({ success: true });
  });

  // ─── Model Usage / Cost Summary ─────────────────────────────────────────
  app.get('/models/usage', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const query = request.query as { days?: string; model_id?: string; user_id?: string; agent_id?: string };
    const daysRaw = query.days;
    const parsedDays = daysRaw === undefined ? 1 : Number.parseInt(String(daysRaw), 10);
    if (!Number.isFinite(parsedDays) || !Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'days must be an integer between 1 and 365' },
      });
      return;
    }
    const days = parsedDays;

    let where = 'WHERE mul.organization_id = $1 AND mul.created_at >= NOW() - ($2 || \' days\')::interval';
    const params: unknown[] = [orgId, String(days)];

    if (query.model_id) {
      params.push(query.model_id);
      where += ` AND mul.model_id = $${params.length}`;
    }
    if (query.user_id) {
      params.push(query.user_id);
      where += ` AND mul.user_id = $${params.length}`;
    }
    if (query.agent_id) {
      params.push(query.agent_id);
      where += ` AND mul.agent_id = $${params.length}`;
    }

    try {
      const res = await pool.query(
        `SELECT mr.id AS model_id,
                mr.name,
                mr.provider,
                mr.model_id AS model_identifier,
                COALESCE(SUM(mul.total_cost), 0)::float AS total_cost,
                COALESCE(SUM(mul.request_tokens), 0)::int AS prompt_tokens,
                COALESCE(SUM(mul.response_tokens), 0)::int AS completion_tokens,
                COUNT(*)::int AS calls
         FROM model_usage_logs mul
         JOIN model_registry mr ON mr.id = mul.model_id
         ${where}
         GROUP BY mr.id, mr.name, mr.provider, mr.model_id
         ORDER BY total_cost DESC NULLS LAST, calls DESC`,
        params,
      );

      reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendModelsSchemaUnavailable(reply, 'usage');
        return;
      }
      throw err;
    }
  });
}
