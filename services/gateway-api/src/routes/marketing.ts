import { FastifyInstance } from 'fastify';
import pg from 'pg';

export async function registerMarketingRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/v1/marketing/status', async () => ({ status: 'ok' }));
}
