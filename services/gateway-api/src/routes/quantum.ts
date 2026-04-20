import { FastifyInstance } from 'fastify';
import pg from 'pg';

export async function registerQuantumRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/v1/quantum/status', async () => ({ status: 'ok' }));
}
