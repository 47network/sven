import Fastify from 'fastify';
import pg from 'pg';
import { connect, type NatsConnection, type Subscription } from 'nats';
import { createLogger } from '@sven/shared';

// ── Quantum-sim library imports ──────────────────────────────────────────────
import {
  createCircuit,
  addGate,
  simulate,
  measure,
  measureMultiple,
  applyNoise,
  circuitToAscii,
  type QuantumCircuit,
  type NoiseModel,
} from '@sven/quantum-sim/simulator';
import {
  getStandardGate,
  listStandardGates,
  Rx,
  Ry,
  Rz,
} from '@sven/quantum-sim/gates';
import {
  runQAOA,
  runGroverSearch,
  runQuantumMonteCarlo,
  generateQuantumRandom,
  runQuantumAnnealing,
  optimizePortfolio,
  type QAOAProblem,
  type AnnealingProblem,
} from '@sven/quantum-sim/algorithms';
import {
  listAvailableBackends,
  getBackend,
  estimateCost,
  JobQueue,
  ResultCache,
  type BackendType,
} from '@sven/quantum-sim/hardware';

// ── Local modules ────────────────────────────────────────────────────────────
import { PgJobStore } from './store/pg-job-store.js';
import {
  subscribeToNats,
  publishJobCompleted,
  publishJobFailed,
  publishJobStatus,
  type NatsPublisherDeps,
} from './nats/subscriber.js';

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = Number(process.env['QUANTUM_PORT'] ?? 9476);
const HOST = process.env['QUANTUM_HOST'] ?? '0.0.0.0';
const DATABASE_URL = process.env['DATABASE_URL'] ?? '';
const NATS_URL = process.env['NATS_URL'] ?? 'nats://localhost:4222';
const DEFAULT_ORG = process.env['QUANTUM_DEFAULT_ORG_ID'] ?? 'default';

const logger = createLogger('quantum-sim');
const engineLogger = {
  info: (...args: unknown[]) => logger.info(String(args[0]), args[1] as Record<string, unknown> | undefined),
  error: (...args: unknown[]) => logger.error(String(args[0]), args[1] as Record<string, unknown> | undefined),
};

// ─── Postgres ────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });
const jobStore = new PgJobStore(pool);

// ─── In-memory helpers ───────────────────────────────────────────────────────

const jobQueue = new JobQueue();
const resultCache = new ResultCache(500);

// ─── NATS ────────────────────────────────────────────────────────────────────

let nc: NatsConnection | undefined;
let natsSubs: Subscription[] = [];

// ─── Circuit builder helper ──────────────────────────────────────────────────

interface CircuitSpec {
  numQubits: number;
  instructions: Array<{ gate: string; qubits: number[]; params?: number[] }>;
}

function buildCircuitFromSpec(spec: CircuitSpec): QuantumCircuit {
  if (!spec.numQubits || spec.numQubits < 1 || spec.numQubits > 25) {
    throw new Error('numQubits must be 1–25');
  }
  let circuit = createCircuit(spec.numQubits);
  for (const inst of spec.instructions) {
    let gate = getStandardGate(inst.gate);
    if (!gate) {
      // Try parametric gates
      const upper = inst.gate.toUpperCase();
      const params = inst.params ?? [];
      if (upper === 'RX' && params.length >= 1) {
        gate = Rx(params[0]!);
      } else if (upper === 'RY' && params.length >= 1) {
        gate = Ry(params[0]!);
      } else if (upper === 'RZ' && params.length >= 1) {
        gate = Rz(params[0]!);
      } else {
        throw new Error(`Unknown gate: ${inst.gate}`);
      }
    }
    circuit = addGate(circuit, gate, inst.qubits);
  }
  return circuit;
}

// ─── Job execution ───────────────────────────────────────────────────────────

async function executeJob(jobId: string, circuit: QuantumCircuit, shots: number, backendId: string, orgId: string): Promise<void> {
  const natsPublisher: NatsPublisherDeps | undefined = nc ? { nc } : undefined;

  try {
    await jobStore.updateStatus(jobId, 'running');
    if (natsPublisher) publishJobStatus(natsPublisher, jobId, 'running');

    // Check cache
    const cached = resultCache.get(circuit, shots, backendId);
    const result = cached ?? simulate(circuit);
    if (!cached) resultCache.set(circuit, shots, backendId, result);

    const measurements = Array.from({ length: Math.min(shots, 10) }, () => measure(result));
    const counts = measureMultiple(result, shots);

    const fullResult = {
      ...result,
      finalState: undefined, // Omit raw state vector (large)
      measurements,
      histogram: Object.fromEntries(counts),
    };

    await jobStore.setResult(jobId, fullResult, measurements);
    jobQueue.updateJob(jobId, { status: 'completed', result, measurements, completedAt: new Date() });

    if (natsPublisher) publishJobCompleted(natsPublisher, jobId, fullResult);
    engineLogger.info('Job completed', { jobId, orgId });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await jobStore.setError(jobId, errorMsg);
    jobQueue.updateJob(jobId, { status: 'failed', error: errorMsg, completedAt: new Date() });
    if (natsPublisher) publishJobFailed(natsPublisher, jobId, errorMsg);
    engineLogger.error('Job failed', { jobId, error: errorMsg });
  }
}

// ─── Fastify ─────────────────────────────────────────────────────────────────

const app = Fastify({ logger: false });

// ── Health ───────────────────────────────────────────────────────────────────

app.get('/healthz', async () => {
  const pgOk = await pool.query('SELECT 1').then(() => 'ok' as const).catch(() => 'fail' as const);
  const natsOk = nc && !nc.isClosed() ? 'ok' as const : 'fail' as const;
  const status = pgOk === 'ok' && natsOk === 'ok' ? 'ok' : 'degraded';
  return { status, checks: { postgres: pgOk, nats: natsOk } };
});

app.get('/readyz', async () => {
  const pgOk = await pool.query('SELECT 1').then(() => 'ok' as const).catch(() => 'fail' as const);
  return { status: pgOk === 'ok' ? 'ok' : 'down', checks: { postgres: pgOk } };
});

// ── Gates ────────────────────────────────────────────────────────────────────

app.get('/v1/quantum/gates', async () => {
  return { gates: listStandardGates() };
});

// ── Backends ─────────────────────────────────────────────────────────────────

app.get('/v1/quantum/backends', async () => {
  return { backends: listAvailableBackends() };
});

app.get<{ Params: { id: string } }>('/v1/quantum/backends/:id', async (req, reply) => {
  const backend = getBackend(req.params.id);
  if (!backend) return reply.code(404).send({ error: 'Backend not found' });
  return backend;
});

// ── Cost estimation ──────────────────────────────────────────────────────────

app.post<{
  Body: { backendType: BackendType; qubitCount: number; gateCount: number; shots: number };
}>('/v1/quantum/cost', async (req) => {
  const { backendType, qubitCount, gateCount, shots } = req.body;
  return estimateCost(backendType, qubitCount, gateCount, shots);
});

// ── Circuit simulation (sync) ────────────────────────────────────────────────

app.post<{
  Body: { circuit: CircuitSpec; shots?: number; noise?: NoiseModel };
}>('/v1/quantum/simulate', async (req) => {
  const { circuit: spec, shots = 1024, noise } = req.body;
  const circuit = buildCircuitFromSpec(spec);
  const result = simulate(circuit);

  let probabilities = result.probabilities;
  if (noise) {
    probabilities = applyNoise(probabilities, noise);
  }

  const counts = measureMultiple({ ...result, probabilities }, shots);
  const ascii = circuitToAscii(circuit);

  return {
    probabilities,
    histogram: Object.fromEntries(counts),
    numQubits: result.numQubits,
    gateCount: result.gateCount,
    circuitDepth: result.circuitDepth,
    ascii,
  };
});

// ── Job management (async) ───────────────────────────────────────────────────

app.post<{
  Body: { circuit: CircuitSpec; shots?: number; backendId?: string; orgId?: string };
}>('/v1/quantum/jobs', async (req, reply) => {
  const { circuit: spec, shots = 1024, backendId = 'local-sim', orgId = DEFAULT_ORG } = req.body;
  const circuit = buildCircuitFromSpec(spec);
  const cost = estimateCost(
    (getBackend(backendId)?.type ?? 'simulator') as BackendType,
    circuit.numQubits,
    circuit.instructions.length,
    shots,
  );

  const job = jobQueue.createJob(backendId, circuit, shots);
  job.estimatedCost = cost;
  await jobStore.insert(job, orgId);

  // Execute asynchronously
  void executeJob(job.id, circuit, shots, backendId, orgId);

  return reply.code(202).send({
    jobId: job.id,
    status: job.status,
    estimatedCost: cost,
  });
});

app.get<{ Params: { id: string } }>('/v1/quantum/jobs/:id', async (req, reply) => {
  const job = await jobStore.getById(req.params.id);
  if (!job) return reply.code(404).send({ error: 'Job not found' });
  return job;
});

app.get<{
  Querystring: { status?: string; limit?: string; offset?: string; orgId?: string };
}>('/v1/quantum/jobs', async (req) => {
  const orgId = req.query.orgId ?? DEFAULT_ORG;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const jobs = await jobStore.list(orgId, req.query.status, limit, offset);
  return { jobs, limit, offset };
});

app.delete<{ Params: { id: string } }>('/v1/quantum/jobs/:id', async (req, reply) => {
  const cancelled = await jobStore.cancel(req.params.id);
  if (!cancelled) return reply.code(404).send({ error: 'Job not found or not cancellable' });
  jobQueue.cancelJob(req.params.id);
  return { ok: true, jobId: req.params.id };
});

app.get<{ Querystring: { orgId?: string } }>('/v1/quantum/jobs/stats', async (req) => {
  const orgId = req.query.orgId ?? DEFAULT_ORG;
  return jobStore.stats(orgId);
});

// ── Algorithms ───────────────────────────────────────────────────────────────

app.post<{
  Body: { problem: QAOAProblem; layers?: number; shots?: number };
}>('/v1/quantum/algorithms/qaoa', async (req) => {
  const { problem, layers = 3, shots = 1024 } = req.body;
  const result = runQAOA(problem, layers, shots);
  return {
    bestSolution: result.bestSolution,
    bestCost: result.bestCost,
    iterations: result.iterations,
    convergenceHistory: result.convergenceHistory,
    histogram: Object.fromEntries(result.measurementCounts),
  };
});

app.post<{
  Body: { numQubits: number; targetIndex: number; shots?: number };
}>('/v1/quantum/algorithms/grover', async (req) => {
  const { numQubits, targetIndex, shots = 1024 } = req.body;
  const result = runGroverSearch(numQubits, targetIndex, shots);
  return {
    targetFound: result.targetFound,
    foundIndex: result.foundIndex,
    iterations: result.iterations,
    successProbability: result.successProbability,
    histogram: Object.fromEntries(result.measurementCounts),
  };
});

app.post<{
  Body: { numQubits: number; samples: number };
}>('/v1/quantum/algorithms/monte-carlo', async (req) => {
  const { numQubits, samples } = req.body;
  // Default evaluator: sum of bits
  const evaluator = (bits: number[]) => bits.reduce((a, b) => a + b, 0);
  return runQuantumMonteCarlo(evaluator, numQubits, samples);
});

app.post<{
  Body: { numBits: number };
}>('/v1/quantum/algorithms/random', async (req) => {
  const { numBits } = req.body;
  if (numBits < 1 || numBits > 10000) {
    return { error: 'numBits must be 1–10000' };
  }
  return generateQuantumRandom(numBits);
});

app.post<{
  Body: { problem: AnnealingProblem; maxIterations?: number };
}>('/v1/quantum/algorithms/annealing', async (req) => {
  const { problem, maxIterations = 1000 } = req.body;
  return runQuantumAnnealing(problem, maxIterations);
});

app.post<{
  Body: {
    assets: string[];
    expectedReturns: number[];
    riskMatrix: number[][];
    riskAversion?: number;
  };
}>('/v1/quantum/algorithms/portfolio', async (req) => {
  const { assets, expectedReturns, riskMatrix, riskAversion = 0.5 } = req.body;
  return optimizePortfolio(assets, expectedReturns, riskMatrix, riskAversion);
});

// ── Cache stats ──────────────────────────────────────────────────────────────

app.get('/v1/quantum/cache/stats', async () => {
  return { cacheSize: resultCache.size() };
});

app.delete('/v1/quantum/cache', async () => {
  resultCache.clear();
  return { ok: true };
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Run migrations
  const migrationSql = await import('node:fs/promises').then((fsp) =>
    fsp.readFile(new URL('../migrations/001_create_quantum_jobs.sql', import.meta.url), 'utf8'),
  );
  await pool.query(migrationSql);
  engineLogger.info('Migrations applied');

  // Connect NATS
  try {
    nc = await connect({ servers: NATS_URL });
    engineLogger.info('NATS connected', { url: NATS_URL });

    natsSubs = subscribeToNats({
      nc,
      logger: engineLogger,
      onSubmit: async (payload) => {
        const spec = payload.circuitJson as CircuitSpec;
        const circuit = buildCircuitFromSpec(spec);
        const cost = estimateCost(
          (getBackend(payload.backendId)?.type ?? 'simulator') as BackendType,
          circuit.numQubits,
          circuit.instructions.length,
          payload.shots,
        );
        const job = jobQueue.createJob(payload.backendId, circuit, payload.shots);
        job.estimatedCost = cost;
        await jobStore.insert(job, payload.orgId);
        void executeJob(job.id, circuit, payload.shots, payload.backendId, payload.orgId);
        return job.id;
      },
      onCancel: async (jobId) => {
        const cancelled = await jobStore.cancel(jobId);
        if (cancelled) jobQueue.cancelJob(jobId);
        return cancelled;
      },
    });
  } catch (err) {
    engineLogger.error('NATS connection failed — running without NATS', { error: String(err) });
  }

  await app.listen({ port: PORT, host: HOST });
  engineLogger.info(`Quantum-sim service listening on ${HOST}:${PORT}`);
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  engineLogger.info(`Received ${signal}, shutting down`);
  for (const sub of natsSubs) sub.unsubscribe();
  if (nc && !nc.isClosed()) await nc.close();
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch((err) => {
  engineLogger.error('Failed to start quantum-sim service', { error: String(err) });
  process.exit(1);
});
