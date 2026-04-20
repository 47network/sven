// ---------------------------------------------------------------------------
// Sven Eidolon Service — Entry point
// ---------------------------------------------------------------------------
// Read-only aggregation over agent-runtime / treasury / marketplace / infra.
// Surfaces:
//   GET /v1/eidolon/snapshot — city state (buildings, citizens, treasury)
//   GET /v1/eidolon/events   — SSE stream of sanitised economy events
//   GET /health              — liveness + dependency status
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect, type NatsConnection } from 'nats';
import { createLogger, buildHealthStatus } from '@sven/shared';
import { rateLimiterHook, corsHook } from '@sven/shared';
import { correlationIdHook } from '@sven/shared';
import { MetricsRegistry, registerMetricsRoute } from '@sven/shared';
import { EidolonRepository } from './repo.js';
import { EidolonEventBus } from './event-bus.js';
import { registerSnapshotRoute } from './routes/snapshot.js';
import { registerEventsRoute } from './routes/events.js';

const logger = createLogger('sven-eidolon');

const PORT = Number(process.env.EIDOLON_PORT || 9479);
const HOST = process.env.EIDOLON_HOST || '0.0.0.0';
const VERSION = '0.1.0';

async function main(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: Number(process.env.EIDOLON_PG_POOL_MAX || 8),
  });

  let nc: NatsConnection | null = null;
  try {
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'sven-eidolon',
      maxReconnectAttempts: -1,
    });
  } catch (err) {
    logger.warn('NATS unavailable; SSE will emit heartbeats only', {
      err: (err as Error).message,
    });
  }

  const repo = new EidolonRepository(pool);
  const bus = new EidolonEventBus();
  bus.start(nc);

  const app = Fastify({ logger: false });

  // CORS — allow eidolon-ui browser requests
  app.addHook('onRequest', corsHook());

  // Correlation ID — propagate or generate per-request
  app.addHook('onRequest', correlationIdHook());

  // Rate limiting — 100 req/min for API, 10 req/min for SSE events endpoint
  app.addHook('onRequest', rateLimiterHook({ max: 100, windowMs: 60_000 }));

  // Prometheus metrics
  const metrics = new MetricsRegistry('sven_eidolon');
  metrics.counter('snapshot_requests_total', 'Total snapshot requests');
  metrics.counter('sse_connections_total', 'Total SSE connections');
  registerMetricsRoute(app, metrics);

  app.get('/health', async () =>
    buildHealthStatus('sven-eidolon', VERSION, [
      { name: 'postgres', status: 'pass' },
      { name: 'nats', status: nc ? 'pass' : 'warn' },
    ]),
  );

  // Readiness probe — verifies Postgres can execute queries
  app.get('/readyz', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready', postgres: 'ok', nats: nc ? 'ok' : 'unavailable' };
    } catch {
      reply.code(503);
      return { status: 'not_ready', postgres: 'error', nats: nc ? 'ok' : 'unavailable' };
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error;
    logger.error('request error', { err: e.message, stack: e.stack });
    reply.code(500).send({ error: 'internal_error' });
  });

  await registerSnapshotRoute(app, repo);
  await registerEventsRoute(app, bus);

  await app.listen({ port: PORT, host: HOST });
  logger.info('sven-eidolon listening', { port: PORT });

  const shutdown = async (sig: string) => {
    logger.info('shutdown', { signal: sig });
    // Force exit after 30s if graceful shutdown hangs
    const forceTimer = setTimeout(() => {
      logger.error('shutdown timeout — forcing exit');
      process.exit(1);
    }, 30_000);
    forceTimer.unref();
    try { await bus.stop(); } catch { /* ignore */ }
    try { await app.close(); } catch { /* ignore */ }
    try { await nc?.drain(); } catch { /* ignore */ }
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('fatal', { err: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
