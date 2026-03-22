import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { requireRole } from './auth.js';

export async function registerPushRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  app.post('/v1/push/register', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['token', 'platform'],
        additionalProperties: false,
        properties: {
          token: { type: 'string', minLength: 1 },
          platform: { type: 'string', enum: ['android', 'ios', 'web'] },
          device_id: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { token?: string; platform?: string; device_id?: string };
    const token = String(body.token || '').trim();
    const platform = String(body.platform || '').trim();
    const deviceId = body.device_id ? String(body.device_id).trim() : null;
    if (!token || !platform) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'token and platform are required' },
      });
    }

    await pool.query(
      `INSERT INTO mobile_push_tokens (id, user_id, platform, token, device_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id, token) DO UPDATE
       SET platform = EXCLUDED.platform,
           device_id = EXCLUDED.device_id,
           updated_at = NOW()`,
      [uuidv7(), request.userId, platform, token, deviceId],
    );

    reply.send({ success: true });
  });

  app.post('/v1/push/unregister', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        additionalProperties: false,
        properties: {
          token: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { token?: string };
    const token = String(body.token || '').trim();
    if (!token) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'token is required' },
      });
    }
    await pool.query(
      `DELETE FROM mobile_push_tokens WHERE user_id = $1 AND token = $2`,
      [request.userId, token],
    );
    reply.send({ success: true });
  });

  app.get('/v1/push/vapid-public-key', { preHandler: requireAuth }, async (_request, reply) => {
    const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '').trim();
    if (!publicKey) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'VAPID public key is not configured' },
      });
    }
    reply.send({ publicKey });
  });
}
