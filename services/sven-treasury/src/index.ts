// ---------------------------------------------------------------------------
// Sven Treasury Service — Entry point
// ---------------------------------------------------------------------------
// HTTP facade over @sven/treasury. Exposes:
//   - accounts, transactions, limits (fiat ledger)
//   - crypto wallets (Base L2) creation, balance, send
//   - classify endpoint (auto/notify/approve) the agent-runtime uses before
//     every spend.
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect } from 'nats';
import { createLogger, buildHealthStatus } from '@sven/shared';
import {
  Ledger,
  ApprovalTiers,
  WalletRegistry,
  EnvSecretResolver,
} from '@sven/treasury';
import { BaseL2Client } from '@sven/treasury/providers/base-l2';
import { rateLimiterHook, corsHook } from '@sven/shared';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerTransactionRoutes } from './routes/transactions.js';
import { registerLimitRoutes } from './routes/limits.js';
import { registerWalletRoutes } from './routes/wallets.js';
import { registerClassifyRoute } from './routes/classify.js';
import { registerEconomyRoutes } from './routes/economy.js';

const logger = createLogger('sven-treasury');

const PORT = Number(process.env.TREASURY_PORT || 9477);
const HOST = process.env.TREASURY_HOST || '0.0.0.0';
const VERSION = '0.1.0';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 10,
  });
  logger.info('Connected to Postgres');

  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'sven-treasury',
    maxReconnectAttempts: -1,
  }).catch((err) => {
    logger.warn('NATS unavailable; running HTTP-only', { err: (err as Error).message });
    return null;
  });

  const ledger = new Ledger(pool);
  const tiers = new ApprovalTiers(pool);
  const walletRegistry = new WalletRegistry(pool);
  const secrets = new EnvSecretResolver();

  const network = (process.env.TREASURY_CHAIN_NETWORK || 'mainnet') as 'mainnet' | 'testnet';
  const baseClient = new BaseL2Client({
    network,
    rpcUrl: process.env.BASE_RPC_URL,
  }).attachResolver(secrets);

  const app = Fastify({ logger: false });

  // Global error handler — structured logging + 500 response
  app.setErrorHandler((err, _req, reply) => {
    logger.error('request error', { err: (err as Error).message, stack: (err as Error).stack });
    reply.code(500).send({ error: 'internal_error', message: 'An unexpected error occurred' });
  });

  // CORS — allow marketplace-ui and admin-ui browser requests
  app.addHook('onRequest', corsHook());

  // Rate limiting — 100 req/min per IP, health/readyz exempt
  app.addHook('onRequest', rateLimiterHook({ max: 100, windowMs: 60_000 }));

  app.get('/health', async () =>
    buildHealthStatus('sven-treasury', VERSION, [
      { name: 'postgres', status: 'pass' },
      { name: 'nats', status: nc ? 'pass' : 'warn' },
      { name: 'base-chain', status: 'pass', message: network },
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

  await registerAccountRoutes(app, ledger);
  await registerTransactionRoutes(app, ledger, nc);
  await registerLimitRoutes(app, tiers);
  await registerWalletRoutes(app, { walletRegistry, baseClient, secrets });
  await registerClassifyRoute(app, tiers);
  await registerEconomyRoutes(app, pool);

  await app.listen({ port: PORT, host: HOST });
  logger.info('sven-treasury listening', { port: PORT, network });

  const shutdown = async (sig: string) => {
    logger.info('shutdown', { signal: sig });
    // Force exit after 30s if graceful shutdown hangs
    const forceTimer = setTimeout(() => {
      logger.error('shutdown timeout — forcing exit');
      process.exit(1);
    }, 30_000);
    forceTimer.unref();
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
