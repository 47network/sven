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
  type BenchmarkSuite, type BenchmarkRun, type ModelComparisonResult,
} from '@sven/model-router/benchmark';
import {
  FleetManager,
  createDefaultFleet,
  type FleetStatus, type FleetNodeStatus, type HotSwapResult,
} from '@sven/model-router/fleet';
import {
  downloadModel, recommendQuantization, checkModelHealth,
  profileModel, runDeployPipeline,
  type DeployTarget, type DownloadResult, type QuantRecommendation,
  type HealthCheckResult, type ProfileResult, type DeployPipelineResult,
} from '@sven/model-router/deploy';

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
  const requireAdmin = requireRole(pool, 'admin');

  const modelRegistry = new ModelRegistry();
  const agentRegistry = new AgentRegistry();
  const benchmarkEngine = new BenchmarkEngine();
  const fleetManager = createDefaultFleet();
  fleetManager.startProbing();

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

  // ── Fleet Monitoring ────────────────────────────────────────────────
  app.get('/v1/model-router/fleet/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const status = fleetManager.getCachedStatus();
      return { success: true, data: status };
    } catch (err) {
      logger.error('fleet/status error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Fleet status failed' } });
    }
  });

  app.post('/v1/model-router/fleet/probe', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const status = await fleetManager.probeAll();
      return { success: true, data: status };
    } catch (err) {
      logger.error('fleet/probe error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Fleet probe failed' } });
    }
  });

  app.get('/v1/model-router/fleet/nodes', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const nodes = fleetManager.listNodes();
      return { success: true, data: nodes };
    } catch (err) {
      logger.error('fleet/nodes error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list fleet nodes' } });
    }
  });

  app.get('/v1/model-router/fleet/nodes/:nodeId', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { nodeId } = request.params as { nodeId: string };
    try {
      const status = fleetManager.getCachedNodeStatus(nodeId);
      if (!status) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Node "${nodeId}" not found` } });
      }
      return { success: true, data: status };
    } catch (err) {
      logger.error('fleet/node error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get node status' } });
    }
  });

  app.post('/v1/model-router/fleet/nodes/:nodeId/probe', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { nodeId } = request.params as { nodeId: string };
    try {
      const status = await fleetManager.probeNode(nodeId);
      if (!status) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Node "${nodeId}" not found` } });
      }
      return { success: true, data: status };
    } catch (err) {
      logger.error('fleet/node/probe error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Node probe failed' } });
    }
  });

  // ── Model Hot-Swap ──────────────────────────────────────────────────
  app.post('/v1/model-router/fleet/nodes/:nodeId/load', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as Record<string, any>;
    if (!body.model) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model name required' } });
    }
    try {
      logger.info('fleet/load requested', { nodeId, model: body.model, userId: (request as any).userId });
      const result = await fleetManager.loadModel(nodeId, body.model);
      const status = result.success ? 200 : 422;
      return reply.status(status).send({ success: result.success, data: result });
    } catch (err) {
      logger.error('fleet/load error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Model load failed' } });
    }
  });

  app.post('/v1/model-router/fleet/nodes/:nodeId/unload', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { nodeId } = request.params as { nodeId: string };
    const body = request.body as Record<string, any>;
    if (!body.model) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model name required' } });
    }
    try {
      logger.info('fleet/unload requested', { nodeId, model: body.model, userId: (request as any).userId });
      const result = await fleetManager.unloadModel(nodeId, body.model);
      const status = result.success ? 200 : 422;
      return reply.status(status).send({ success: result.success, data: result });
    } catch (err) {
      logger.error('fleet/unload error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Model unload failed' } });
    }
  });

  // ── Benchmark Comparison ────────────────────────────────────────────
  app.post('/v1/model-router/models/benchmark/compare', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.local_run_id || !body.cloud_run_id || !body.local_model_id || !body.cloud_model_id) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'local_run_id, cloud_run_id, local_model_id, and cloud_model_id required' },
      });
    }
    try {
      const comparison = benchmarkEngine.recordComparison(
        body.local_run_id,
        body.cloud_run_id,
        body.local_model_id,
        body.cloud_model_id,
        body.cloud_cost_per_1k_tokens,
      );
      if (!comparison) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'One or both benchmark runs not found or incomplete' } });
      }
      return { success: true, data: comparison };
    } catch (err) {
      logger.error('benchmark/compare error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Comparison failed' } });
    }
  });

  app.get('/v1/model-router/models/benchmark/comparisons', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const query = request.query as { model_id?: string };
    try {
      const comparisons = benchmarkEngine.getComparisons(query.model_id);
      return { success: true, data: comparisons };
    } catch (err) {
      logger.error('benchmark/comparisons error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list comparisons' } });
    }
  });

  // ── Deploy Pipeline ─────────────────────────────────────────────────
  app.post('/v1/model-router/deploy/download', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.model_name || !body.target || !body.node_endpoint) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'model_name, target (ollama|llama-server), and node_endpoint required' },
      });
    }
    if (body.target !== 'ollama' && body.target !== 'llama-server') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target must be ollama or llama-server' } });
    }
    try {
      logger.info('deploy/download requested', { model: body.model_name, target: body.target, userId: (request as any).userId });
      const result = await downloadModel({
        modelName: body.model_name,
        target: body.target,
        nodeEndpoint: body.node_endpoint,
        force: body.force === true,
      });
      return { success: result.success, data: result };
    } catch (err) {
      logger.error('deploy/download error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Download failed' } });
    }
  });

  app.post('/v1/model-router/deploy/quantize-recommend', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.model_name || !body.parameter_count_b || !body.available_vram_mb) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'model_name, parameter_count_b, and available_vram_mb required' },
      });
    }
    try {
      const rec = recommendQuantization(body.model_name, Number(body.parameter_count_b), Number(body.available_vram_mb));
      return { success: true, data: rec };
    } catch (err) {
      logger.error('deploy/quantize-recommend error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Quantization recommendation failed' } });
    }
  });

  app.post('/v1/model-router/deploy/health-check', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.model_name || !body.node_endpoint || !body.target) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'model_name, node_endpoint, and target required' },
      });
    }
    if (body.target !== 'ollama' && body.target !== 'llama-server') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target must be ollama or llama-server' } });
    }
    try {
      const result = await checkModelHealth(body.model_name, body.node_endpoint, body.target);
      return { success: result.healthy, data: result };
    } catch (err) {
      logger.error('deploy/health-check error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Health check failed' } });
    }
  });

  app.post('/v1/model-router/deploy/profile', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.model_name || !body.node_endpoint || !body.target) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'model_name, node_endpoint, and target required' },
      });
    }
    if (body.target !== 'ollama' && body.target !== 'llama-server') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target must be ollama or llama-server' } });
    }
    try {
      logger.info('deploy/profile requested', { model: body.model_name, target: body.target });
      const result = await profileModel(body.model_name, body.node_endpoint, body.target);
      return { success: true, data: result };
    } catch (err) {
      logger.error('deploy/profile error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Profiling failed' } });
    }
  });

  app.post('/v1/model-router/deploy/pipeline', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.model_name || !body.target || !body.node_endpoint) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'model_name, target, and node_endpoint required' },
      });
    }
    if (body.target !== 'ollama' && body.target !== 'llama-server') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'target must be ollama or llama-server' } });
    }
    try {
      logger.info('deploy/pipeline requested', { model: body.model_name, target: body.target, userId: (request as any).userId });
      const result = await runDeployPipeline({
        modelName: body.model_name,
        target: body.target,
        nodeEndpoint: body.node_endpoint,
        parameterCountB: body.parameter_count_b ? Number(body.parameter_count_b) : undefined,
        availableVramMb: body.available_vram_mb ? Number(body.available_vram_mb) : undefined,
        skipDownload: body.skip_download === true,
        skipProfile: body.skip_profile === true,
        force: body.force === true,
      });
      return { success: result.overallSuccess, data: result };
    } catch (err) {
      logger.error('deploy/pipeline error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Deploy pipeline failed' } });
    }
  });

  logger.info('Model Router routes registered (/v1/model-router/*)');
}
