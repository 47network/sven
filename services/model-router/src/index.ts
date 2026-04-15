// ---------------------------------------------------------------------------
// Model Router Service — Entry Point
// ---------------------------------------------------------------------------
// Standalone service for multi-model inference routing, GPU fleet health
// monitoring, benchmark orchestration, and VRAM budget management.
//
// Port: 9471 (configurable via ROUTER_PORT)
// Dependencies: Postgres, NATS
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect, JSONCodec } from 'nats';
import crypto from 'node:crypto';
import { createLogger } from '@sven/shared';

// Pure functions from the library package
import { ModelRegistry, type ModelEntry, type TaskType } from '@sven/model-router/registry';
import {
  classifyTask, scoreModel, routeRequest,
  calculateVramBudget, suggestEviction, splitContext,
  type InferenceRequest,
} from '@sven/model-router/router';
import { createDefaultFleet, type FleetNode } from '@sven/model-router/fleet';
import {
  downloadModel, recommendQuantization, checkModelHealth,
  profileModel, runDeployPipeline,
  type DeployTarget,
  type DeployPipelineResult,
} from '@sven/model-router/deploy';

// Postgres-backed implementations
import { PgModelRegistry } from './registry/pg-model-registry.js';
import { PgFleetRegistry } from './fleet/pg-fleet-registry.js';
import { FleetHealthMonitor } from './fleet/fleet-health-monitor.js';
import { PgRoutingLog } from './routing/pg-routing-log.js';
import { PgBenchmarkStore } from './benchmark/pg-benchmark-store.js';
import { ModelRouterPublisher } from './nats/publisher.js';

const logger = createLogger('model-router-service');
const jc = JSONCodec();

/* ─── Configuration ──────────────────────────────────────────────────── */

const PORT = parseInt(process.env.ROUTER_PORT || '9471', 10);
const HOST = process.env.ROUTER_HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const DEFAULT_ORG_ID = process.env.ROUTER_DEFAULT_ORG_ID || 'default';
const PROBE_INTERVAL_MS = parseInt(process.env.ROUTER_PROBE_INTERVAL_MS || '30000', 10);
const VRAM_ALERT_PCT = parseInt(process.env.ROUTER_VRAM_ALERT_PCT || '90', 10);

/* ─── Bootstrap ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // ── Postgres ──
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    logger.error('Postgres pool error', { error: err.message });
  });

  // Verify connectivity
  const client = await pool.connect();
  client.release();
  logger.info('Postgres connected');

  // ── NATS ──
  const nc = await connect({ servers: NATS_URL });
  logger.info('NATS connected', { server: NATS_URL });

  // ── Initialize components ──
  const modelRegistry = new PgModelRegistry(pool);
  const fleetRegistry = new PgFleetRegistry(pool);
  const routingLog = new PgRoutingLog(pool);
  const benchmarkStore = new PgBenchmarkStore(pool);
  const publisher = new ModelRouterPublisher(nc);

  // In-memory registry for pure routing functions (populated from Postgres)
  const memRegistry = new ModelRegistry();

  // Fleet health monitor
  const fleetMonitor = new FleetHealthMonitor(fleetRegistry, nc, DEFAULT_ORG_ID, {
    probeIntervalMs: PROBE_INTERVAL_MS,
    vramAlertThresholdPct: VRAM_ALERT_PCT,
  });

  // Seed default fleet nodes from env if DB is empty
  await seedDefaultFleet(fleetRegistry, DEFAULT_ORG_ID);

  // Start fleet health monitoring
  fleetMonitor.start();

  // Sync Postgres models into in-memory registry for pure scoring functions
  const syncMemRegistry = async (): Promise<void> => {
    const models = await modelRegistry.list(DEFAULT_ORG_ID);
    for (const m of models) {
      memRegistry.register(m);
    }
  };
  await syncMemRegistry();

  // Periodic re-sync (every 60s)
  const syncTimer = setInterval(() => { void syncMemRegistry(); }, 60_000);

  // ── Fastify ──
  const app = Fastify({ logger: false });

  // ── Health Endpoints ──────────────────────────────────────────────────

  app.get('/healthz', async () => ({ status: 'ok', service: 'model-router', uptime: process.uptime() }));

  app.get('/readyz', async (_req, reply) => {
    try {
      const pgCheck = await pool.query('SELECT 1');
      const natsOk = nc.isClosed() ? 'fail' : 'ok';
      const status = pgCheck.rows.length > 0 && natsOk === 'ok' ? 'ok' : 'degraded';
      return { status, checks: { postgres: pgCheck.rows.length > 0 ? 'ok' : 'fail', nats: natsOk } };
    } catch {
      return reply.status(503).send({ status: 'down', checks: { postgres: 'fail', nats: 'unknown' } });
    }
  });

  // ── Model Registry Routes ─────────────────────────────────────────────

  app.get('/v1/models', async () => {
    const models = await modelRegistry.list(DEFAULT_ORG_ID);
    return { success: true, data: models };
  });

  app.get<{ Params: { id: string } }>('/v1/models/:id', async (request, reply) => {
    const model = await modelRegistry.get(request.params.id, DEFAULT_ORG_ID);
    if (!model) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
    return { success: true, data: model };
  });

  app.post('/v1/models/register', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body.id || !body.name || !body.parameterCount) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'id, name, and parameterCount are required' } });
    }
    const entry: ModelEntry = {
      id: body.id as string,
      name: body.name as string,
      provider: (body.provider as string) || 'local',
      version: (body.version as string) || '1.0',
      parameterCount: body.parameterCount as string,
      quantization: (body.quantization as ModelEntry['quantization']) || 'gguf',
      supportedTasks: (body.supportedTasks as TaskType[]) || ['chat'],
      vramRequirementMb: (body.vramRequirementMb as number) || 0,
      diskSizeMb: (body.diskSizeMb as number) || 0,
      contextWindow: (body.contextWindow as number) || 4096,
      maxOutputTokens: (body.maxOutputTokens as number) || 2048,
      license: (body.license as string) || 'unknown',
      licenseCommercialUse: (body.licenseCommercialUse as boolean) || false,
      endpoint: (body.endpoint as string) || null,
      hostDevice: (body.hostDevice as string) || null,
      status: (body.status as ModelEntry['status']) || 'available',
      tokensPerSecond: (body.tokensPerSecond as number) || null,
      lastHealthCheck: null,
      registeredAt: new Date().toISOString(),
      metadata: (body.metadata as Record<string, unknown>) || {},
    };
    await modelRegistry.register(entry, DEFAULT_ORG_ID);
    memRegistry.register(entry);
    publisher.publishModelRegistered(entry, DEFAULT_ORG_ID);
    return { success: true, data: { registered: entry.id } };
  });

  app.delete<{ Params: { id: string } }>('/v1/models/:id', async (request, reply) => {
    const model = await modelRegistry.get(request.params.id, DEFAULT_ORG_ID);
    if (!model) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
    const deleted = await modelRegistry.unregister(request.params.id, DEFAULT_ORG_ID);
    if (deleted) {
      memRegistry.unregister(request.params.id);
      publisher.publishModelUnregistered(request.params.id, DEFAULT_ORG_ID);
    }
    return { success: true, data: { deleted } };
  });

  app.patch<{ Params: { id: string } }>('/v1/models/:id/status', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const newStatus = body.status as ModelEntry['status'];
    if (!newStatus) return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'status is required' } });
    const model = await modelRegistry.get(request.params.id, DEFAULT_ORG_ID);
    if (!model) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } });
    const oldStatus = model.status;
    await modelRegistry.setStatus(request.params.id, newStatus);
    publisher.publishStatusChanged(request.params.id, oldStatus, newStatus);
    return { success: true, data: { modelId: request.params.id, oldStatus, newStatus } };
  });

  // ── Routing Routes ────────────────────────────────────────────────────

  app.post('/v1/route', async (request) => {
    const body = request.body as Record<string, unknown>;
    const startMs = Date.now();

    const inferenceReq: InferenceRequest = {
      id: crypto.randomUUID(),
      task: (body.task as TaskType) || classifyTask((body.prompt as string) || ''),
      prompt: (body.prompt as string) || '',
      preferredModel: body.preferredModel as string | undefined,
      preferLocal: body.preferLocal !== false,
      latencyBudgetMs: body.latencyBudgetMs as number | undefined,
      qualityPriority: (body.qualityPriority as 'speed' | 'balanced' | 'quality') || 'balanced',
    };

    const decision = routeRequest(memRegistry, inferenceReq);
    const latencyMs = Date.now() - startMs;

    // Log to Postgres
    await routingLog.record({
      requestId: inferenceReq.id,
      orgId: DEFAULT_ORG_ID,
      task: inferenceReq.task,
      priority: inferenceReq.qualityPriority || 'balanced',
      modelId: decision.modelId,
      modelName: decision.modelName,
      score: decision.score,
      reason: decision.reason,
      fallbackChain: decision.fallbackChain,
      latencyMs,
    });

    // Publish NATS event
    publisher.publishRouteDecision({
      requestId: inferenceReq.id,
      task: inferenceReq.task,
      modelId: decision.modelId,
      modelName: decision.modelName,
      score: decision.score,
      reason: decision.reason,
      fallbackChain: decision.fallbackChain,
      orgId: DEFAULT_ORG_ID,
    });

    return { success: true, data: { ...decision, requestId: inferenceReq.id, latencyMs } };
  });

  app.post('/v1/classify', async (request) => {
    const body = request.body as Record<string, unknown>;
    const input = (body.input as string) || '';
    const task = classifyTask(input);
    return { success: true, data: { task, input: input.substring(0, 200) } };
  });

  app.get('/v1/routing/stats', async () => {
    const stats = await routingLog.getStats(DEFAULT_ORG_ID);
    return { success: true, data: stats };
  });

  app.get('/v1/routing/history', async (request) => {
    const query = request.query as Record<string, string>;
    const limit = Math.min(parseInt(query.limit || '50', 10), 500);
    const offset = parseInt(query.offset || '0', 10);
    const decisions = await routingLog.listByOrg(DEFAULT_ORG_ID, limit, offset);
    return { success: true, data: decisions };
  });

  // ── VRAM Management Routes ────────────────────────────────────────────

  app.post('/v1/vram/budget', async (request) => {
    const body = request.body as Record<string, unknown>;
    const totalVramMb = (body.totalVramMb as number) || 40_000;
    const budget = calculateVramBudget(memRegistry, totalVramMb);
    return { success: true, data: budget };
  });

  app.post('/v1/vram/eviction', async (request) => {
    const body = request.body as Record<string, unknown>;
    const neededMb = (body.neededVramMb as number) || 0;
    const totalMb = (body.totalVramMb as number) || 40_000;
    const evictions = suggestEviction(memRegistry, neededMb, totalMb);
    return { success: true, data: { evictions } };
  });

  // ── Fleet Routes ──────────────────────────────────────────────────────

  app.get('/v1/fleet/status', async () => {
    const status = await fleetRegistry.getFleetStatus(DEFAULT_ORG_ID);
    return { success: true, data: status };
  });

  app.get('/v1/fleet/nodes', async () => {
    const nodes = await fleetRegistry.listNodes(DEFAULT_ORG_ID);
    return { success: true, data: nodes };
  });

  app.get<{ Params: { nodeId: string } }>('/v1/fleet/nodes/:nodeId', async (request, reply) => {
    const node = await fleetRegistry.getNode(request.params.nodeId, DEFAULT_ORG_ID);
    if (!node) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    return { success: true, data: node };
  });

  app.post('/v1/fleet/nodes', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body.id || !body.name || !body.endpoint || !body.runtime) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'id, name, endpoint, and runtime are required' } });
    }
    const node: FleetNode = {
      id: body.id as string,
      name: body.name as string,
      endpoint: body.endpoint as string,
      runtime: body.runtime as FleetNode['runtime'],
      gpus: (body.gpus as FleetNode['gpus']) || [],
      totalVramMb: (body.totalVramMb as number) || 0,
      healthy: false,
      lastProbe: null,
    };
    await fleetRegistry.registerNode(node, DEFAULT_ORG_ID);
    return { success: true, data: { registered: node.id } };
  });

  app.delete<{ Params: { nodeId: string } }>('/v1/fleet/nodes/:nodeId', async (request) => {
    const deleted = await fleetRegistry.unregisterNode(request.params.nodeId, DEFAULT_ORG_ID);
    return { success: true, data: { deleted } };
  });

  app.post('/v1/fleet/probe', async () => {
    const status = await fleetMonitor.sweep();
    return { success: true, data: status };
  });

  app.post<{ Params: { nodeId: string } }>('/v1/fleet/nodes/:nodeId/probe', async (request, reply) => {
    const status = await fleetRegistry.probeNode(request.params.nodeId, DEFAULT_ORG_ID);
    if (!status) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found or unreachable' } });
    return { success: true, data: status };
  });

  app.get<{ Params: { nodeId: string } }>('/v1/fleet/nodes/:nodeId/history', async (request) => {
    const query = request.query as Record<string, string>;
    const limit = Math.min(parseInt(query.limit || '100', 10), 1000);
    const history = await fleetRegistry.getProbeHistory(request.params.nodeId, limit);
    return { success: true, data: history };
  });

  // ── Hot-Swap Routes ───────────────────────────────────────────────────

  app.post<{ Params: { nodeId: string } }>('/v1/fleet/nodes/:nodeId/load', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const modelName = body.model as string;
    if (!modelName) return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model is required' } });

    const node = await fleetRegistry.getNode(request.params.nodeId, DEFAULT_ORG_ID);
    if (!node) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

    if (node.runtime !== 'ollama') {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED', message: `Hot-swap not supported on ${node.runtime} — model is set at process startup` },
      });
    }

    // Use the in-memory fleet manager for actual hot-swap operations
    const inMemFleet = createDefaultFleet();
    inMemFleet.registerNode(node);
    const result = await inMemFleet.loadModel(request.params.nodeId, modelName);

    publisher.publishHotswapResult(result);

    // Re-probe after hot-swap
    await fleetRegistry.probeNode(request.params.nodeId, DEFAULT_ORG_ID);

    return { success: true, data: result };
  });

  app.post<{ Params: { nodeId: string } }>('/v1/fleet/nodes/:nodeId/unload', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const modelName = body.model as string;
    if (!modelName) return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model is required' } });

    const node = await fleetRegistry.getNode(request.params.nodeId, DEFAULT_ORG_ID);
    if (!node) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });

    if (node.runtime !== 'ollama') {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED', message: `Hot-swap not supported on ${node.runtime}` },
      });
    }

    const inMemFleet = createDefaultFleet();
    inMemFleet.registerNode(node);
    const result = await inMemFleet.unloadModel(request.params.nodeId, modelName);

    publisher.publishHotswapResult(result);
    await fleetRegistry.probeNode(request.params.nodeId, DEFAULT_ORG_ID);

    return { success: true, data: result };
  });

  // ── Deploy Routes ─────────────────────────────────────────────────────

  app.post('/v1/deploy/recommend-quant', async (request) => {
    const body = request.body as Record<string, unknown>;
    const modelName = (body.modelName as string) || 'unknown';
    const parameterCountB = (body.parameterCountB as number) || 7;
    const availableVramMb = (body.availableVramMb as number) || 12_000;
    const rec = recommendQuantization(modelName, parameterCountB, availableVramMb);
    return { success: true, data: rec };
  });

  app.post('/v1/deploy/health-check', async (request) => {
    const body = request.body as Record<string, unknown>;
    const modelName = body.modelName as string;
    const nodeEndpoint = body.endpoint as string;
    const target: DeployTarget = (body.runtime as DeployTarget) || 'ollama';
    const result = await checkModelHealth(modelName, nodeEndpoint, target);
    return { success: true, data: result };
  });

  app.post('/v1/deploy/profile', async (request) => {
    const body = request.body as Record<string, unknown>;
    const modelName = body.modelName as string;
    const nodeEndpoint = body.endpoint as string;
    const target: DeployTarget = (body.runtime as DeployTarget) || 'ollama';
    const result = await profileModel(modelName, nodeEndpoint, target);
    return { success: true, data: result };
  });

  app.post('/v1/deploy/pipeline', async (request) => {
    const body = request.body as Record<string, unknown>;
    const modelName = body.modelName as string;
    const nodeEndpoint = body.endpoint as string;
    const runtime: DeployTarget = (body.runtime as DeployTarget) || 'ollama';
    const nodeId = (body.nodeId as string) || 'unknown';
    const paramB = (body.parameterCountB as number) || undefined;
    const vramMb = (body.availableVramMb as number) || undefined;

    publisher.publishDeployStatus(modelName, nodeId, 'started', 'Deploy pipeline initiated');
    const result: DeployPipelineResult = await runDeployPipeline({
      modelName,
      target: runtime,
      nodeEndpoint,
      parameterCountB: paramB,
      availableVramMb: vramMb,
      skipDownload: (body.skipDownload as boolean) || false,
      skipProfile: (body.skipProfile as boolean) || false,
    });
    publisher.publishDeployStatus(
      modelName, nodeId,
      result.overallSuccess ? 'completed' : 'failed',
      result.overallSuccess ? 'Deploy pipeline completed' : 'Deploy pipeline failed',
    );

    return { success: true, data: result };
  });

  // ── Benchmark Routes ──────────────────────────────────────────────────

  app.post('/v1/benchmarks', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body.suiteId || !body.modelId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'suiteId and modelId are required' } });
    }
    const runId = crypto.randomUUID();
    await benchmarkStore.createRun({
      id: runId,
      suiteId: body.suiteId as string,
      modelId: body.modelId as string,
      orgId: DEFAULT_ORG_ID,
      metadata: (body.metadata as Record<string, unknown>) || {},
    });
    return { success: true, data: { runId } };
  });

  app.get('/v1/benchmarks', async () => {
    const runs = await benchmarkStore.listRuns(DEFAULT_ORG_ID);
    return { success: true, data: runs };
  });

  app.get<{ Params: { runId: string } }>('/v1/benchmarks/:runId', async (request, reply) => {
    const run = await benchmarkStore.getRun(request.params.runId);
    if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Benchmark run not found' } });
    return { success: true, data: run };
  });

  app.post<{ Params: { runId: string } }>('/v1/benchmarks/:runId/result', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const run = await benchmarkStore.getRun(request.params.runId);
    if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Benchmark run not found' } });
    await benchmarkStore.recordTaskResult(request.params.runId, body);
    return { success: true };
  });

  app.post<{ Params: { runId: string } }>('/v1/benchmarks/:runId/complete', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const run = await benchmarkStore.getRun(request.params.runId);
    if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Benchmark run not found' } });
    await benchmarkStore.completeRun(request.params.runId, body.aggregateMetrics || {});
    publisher.publishBenchmarkComplete(request.params.runId, run.modelId, run.suiteId, DEFAULT_ORG_ID);
    return { success: true };
  });

  // ── Context Splitting ─────────────────────────────────────────────────

  app.post('/v1/split-context', async (request) => {
    const body = request.body as Record<string, unknown>;
    const text = (body.text as string) || '';
    const maxTokens = (body.maxTokens as number) || 4096;
    const chunks = splitContext(text, maxTokens);
    return { success: true, data: { chunks, count: chunks.length } };
  });

  // ── Start Server ──────────────────────────────────────────────────────

  await app.listen({ host: HOST, port: PORT });
  logger.info(`Model router service listening on ${HOST}:${PORT}`);

  // ── Graceful Shutdown ─────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);
    fleetMonitor.stop();
    clearInterval(syncTimer);
    await app.close();
    await nc.drain();
    await pool.end();
    logger.info('Model router service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/* ─── Seed Default Fleet ────────────────────────────────────────────── */

async function seedDefaultFleet(fleetRegistry: PgFleetRegistry, orgId: string): Promise<void> {
  const existing = await fleetRegistry.listNodes(orgId);
  if (existing.length > 0) return;

  const defaultNodes: FleetNode[] = [
    {
      id: 'vm5-sven-ai',
      name: 'VM5 Sven AI (Dual AMD GPU)',
      endpoint: process.env.SVEN_LLM_POWER_ENDPOINT || 'http://10.47.47.9:8080',
      runtime: 'llama-server',
      gpus: [
        { index: 0, name: 'RX 9070 XT', vramTotalMb: 16_300, vramUsedMb: 0, vramFreeMb: 16_300, utilizationPercent: null },
        { index: 1, name: 'RX 6750 XT', vramTotalMb: 12_288, vramUsedMb: 0, vramFreeMb: 12_288, utilizationPercent: null },
      ],
      totalVramMb: 28_500,
      healthy: false,
      lastProbe: null,
    },
    {
      id: 'vm13-kaldorei',
      name: 'VM13 Kaldorei (RTX 3060)',
      endpoint: process.env.SVEN_LLM_ENDPOINT || 'http://10.47.47.13:11434',
      runtime: 'ollama',
      gpus: [
        { index: 0, name: 'RTX 3060', vramTotalMb: 12_288, vramUsedMb: 0, vramFreeMb: 12_288, utilizationPercent: null },
      ],
      totalVramMb: 12_288,
      healthy: false,
      lastProbe: null,
    },
  ];

  for (const node of defaultNodes) {
    await fleetRegistry.registerNode(node, orgId);
  }

  logger.info('Seeded default fleet nodes', { count: defaultNodes.length });
}

/* ─── Run ────────────────────────────────────────────────────────────── */

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
