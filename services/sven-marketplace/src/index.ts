// ---------------------------------------------------------------------------
// Sven Marketplace Service — entry point (port 9478)
// ---------------------------------------------------------------------------
// Public + seller + order APIs backing market.sven.systems. Uses
// @sven/treasury for all settlement postings so every sale is reflected
// in the double-entry ledger.
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';
import { Ledger } from '@sven/treasury';
import { MarketplaceRepository } from './repo.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerListingRoutes } from './routes/listings.js';
import { registerOrderRoutes } from './routes/orders.js';

const logger = createLogger('sven-marketplace');
const PORT = Number(process.env.MARKETPLACE_PORT || 9478);
const HOST = process.env.MARKETPLACE_HOST || '0.0.0.0';
const VERSION = '0.1.0';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 10,
  });

  const ledger = new Ledger(pool);
  const repo = new MarketplaceRepository(pool, ledger);

  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  app.get('/healthz', async () => ({
    service: 'sven-marketplace',
    version: VERSION,
    status: 'ok',
    uptime: process.uptime(),
  }));

  registerPublicRoutes(app, repo);
  registerListingRoutes(app, repo);
  registerOrderRoutes(app, repo);

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error;
    logger.error('Unhandled error', { err: e.message, stack: e.stack });
    reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'internal error' } });
  });

  const shutdown = async (sig: string) => {
    logger.info(`${sig} received, shutting down`);
    try { await app.close(); } catch {}
    try { await pool.end(); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ port: PORT, host: HOST });
  logger.info(`sven-marketplace listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
