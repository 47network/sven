import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  ModelRegistry,
  type ModelEntry,
  type TaskType,
} from '@sven/model-router/registry';
import {
  classifyTask, scoreModel, routeRequest,
  calculateVramBudget, suggestEviction, splitContext,
  type InferenceRequest, type RoutingDecision,
} from '@sven/model-router/router';
import {
  AgentRegistry,
  type AgentDefinition, type AgentInstance,
} from '@sven/model-router/agency';
import {
  BenchmarkEngine,
  type BenchmarkSuite, type BenchmarkRun,
} from '@sven/model-router/benchmark';

const logger = createLogger('gateway-model-router');

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

async function requireTenantMembership(pool: pg.Pool, request: any, reply: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  const userId = String(request.userId || '').trim();
  if (!orgId) {
    reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    return null;
  }
  const membership = await pool.query(
    `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [orgId, userId],
  );
  if (membership.rows.length === 0) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Active organization membership required' } });
    return null;
  }
  return orgId;
}

export async function registerModelRouterRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  const modelRegistry = new ModelRegistry();
  const agentRegistry = new AgentRegistry();
  const benchmarkEngine = new BenchmarkEngine();

  // ── Model Registry ──────────────────────────────────────────────────
  app.get('/v1/model-router/models', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const models = modelRegistry.list();
      return { success: true, data: models };
    } catch (err) {
      logger.error('models/list error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list models' } });
    }
  });

  app.post('/v1/model-router/models/register', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.id || !body.name || !body.tasks) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'id, name, and tasks are required' } });
    }
    try {
      modelRegistry.register(body as ModelEntry);
      return { success: true, data: { registered: body.id } };
    } catch (err) {
      logger.error('models/register error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to register model' } });
    }
  });

  // ── Routing ─────────────────────────────────────────────────────────
  app.post('/v1/model-router/models/route', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.input) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'input is required' } });
    }
    try {
      const task = classifyTask(body.input);
      const decision = routeRequest(
        modelRegistry,
        { id: uuidv7(), task, prompt: body.input, maxTokens: body.max_tokens || 4096, qualityPriority: body.priority || 'balanced' } as InferenceRequest,
      );
      return { success: true, data: { task, decision } };
    } catch (err) {
      logger.error('models/route error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Routing failed' } });
    }
  });

  app.post('/v1/model-router/models/classify', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { input } = request.body as Record<string, any>;
    if (!input || typeof input !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'input string required' } });
    }
    try {
      const task = classifyTask(input);
      return { success: true, data: { task } };
    } catch (err) {
      logger.error('models/classify error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Task classification failed' } });
    }
  });

  // ── VRAM Budget ─────────────────────────────────────────────────────
  app.post('/v1/model-router/models/vram-budget', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { total_vram_gb = 24, reserved_gb = 2 } = request.body as Record<string, any>;
    try {
      const budget = calculateVramBudget(modelRegistry, (total_vram_gb - reserved_gb) * 1024);
      return { success: true, data: budget };
    } catch (err) {
      logger.error('models/vram-budget error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'VRAM budget calculation failed' } });
    }
  });

  app.post('/v1/model-router/models/eviction', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { required_vram_gb = 8, total_vram_gb = 24 } = request.body as Record<string, any>;
    try {
      const suggestion = suggestEviction(modelRegistry, required_vram_gb * 1024, total_vram_gb * 1024);
      return { success: true, data: suggestion };
    } catch (err) {
      logger.error('models/eviction error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Eviction suggestion failed' } });
    }
  });

  // ── Agent Registry ──────────────────────────────────────────────────
  app.get('/v1/model-router/agents', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const agents = agentRegistry.listDefinitions();
      return { success: true, data: agents };
    } catch (err) {
      logger.error('agents/list error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list agents' } });
    }
  });

  app.post('/v1/model-router/agents/spawn', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.definition_id) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'definition_id required' } });
    }
    try {
      const instance = agentRegistry.spawn(body.definition_id, body.parent_instance_id);
      if (!instance) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Agent definition "${body.definition_id}" not found` } });
      }
      try {
        await pool.query(
          `INSERT INTO agent_instances (id, org_id, definition_id, status, config, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [instance.instanceId, orgId, body.definition_id, instance.lifecycle, JSON.stringify(body.config || {})],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: instance };
    } catch (err) {
      logger.error('agents/spawn error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Agent spawn failed' } });
    }
  });

  // ── Benchmarks ──────────────────────────────────────────────────────
  app.post('/v1/model-router/models/benchmark', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.suite_id || !body.model_id) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'suite_id and model_id required' } });
    }
    try {
      const run = benchmarkEngine.createRun(body.suite_id, body.model_id, body.model_name || body.model_id);
      if (!run) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Benchmark suite "${body.suite_id}" not found` } });
      }
      try {
        await pool.query(
          `INSERT INTO model_benchmark_runs (id, org_id, model_id, suite_id, results, started_at, finished_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [run.id, orgId, body.model_id, body.suite_id, JSON.stringify(run)],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { run_id: run.id, results: run } };
    } catch (err) {
      logger.error('models/benchmark error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Benchmark failed' } });
    }
  });

  app.get('/v1/model-router/models/benchmark/history', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, model_id, suite_id, started_at, finished_at FROM model_benchmark_runs WHERE org_id = $1 ORDER BY started_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Benchmark schema not available' } });
      }
      throw err;
    }
  });

  // ── Context Splitting ───────────────────────────────────────────────
  app.post('/v1/model-router/models/split-context', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { text, max_chunk_tokens = 4096 } = request.body as Record<string, any>;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    try {
      const chunks = splitContext(text, max_chunk_tokens);
      return { success: true, data: { chunks, count: chunks.length } };
    } catch (err) {
      logger.error('models/split-context error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Context splitting failed' } });
    }
  });

  logger.info('Model Router routes registered (/v1/model-router/*)');
}
