import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';

export async function registerAdminRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  app.get('/v1/admin/health', async () => ({ status: 'ok' }));
}
