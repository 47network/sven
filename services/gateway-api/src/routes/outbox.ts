import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, OutboxEnqueueEvent } from '@sven/shared';
import { v7 as uuidv7 } from 'uuid';
import { createHash, timingSafeEqual } from 'node:crypto';

const logger = createLogger('gateway-outbox');
const jc = JSONCodec();
const OUTBOX_LEASE_SECONDS = Number.parseInt(process.env.OUTBOX_LEASE_SECONDS || '120', 10) || 120;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function normalizeOutboxBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

export async function registerOutboxRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  const extractAckChannel = (request: any): string | null => {
    const raw = request?.body?.channel;
    if (typeof raw !== 'string') return null;
    const channel = raw.trim();
    return channel.length ? channel : null;
  };

  const respondOutboxMutationMiss = async (reply: any, id: string, channel: string) => {
    const existing = await pool.query(`SELECT status, channel FROM outbox WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        error: { code: 'OUTBOX_ITEM_NOT_FOUND', message: 'Outbox item not found' },
      });
    }
    if (String(existing.rows[0].channel || '') !== channel) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'OUTBOX_CHANNEL_SCOPE_MISMATCH',
          message: 'Outbox item does not belong to adapter channel scope',
        },
      });
    }

    return reply.code(409).send({
      success: false,
      error: {
        code: 'OUTBOX_ITEM_INVALID_STATE',
        message: `Outbox item cannot be updated from status=${existing.rows[0].status}`,
      },
    });
  };

  const verifyAdapterToken = async (request: any, reply: any) => {
    const token = String(request.headers?.['x-sven-adapter-token'] || '').trim();
    if (!token) {
      reply.status(401).send({
        success: false,
        error: { code: 'MISSING_ADAPTER_TOKEN', message: 'X-SVEN-ADAPTER-TOKEN required' },
      });
      return;
    }

    const expectedToken = String(process.env.SVEN_ADAPTER_TOKEN || '').trim();
    if (!expectedToken || !safeEqual(token, expectedToken)) {
      reply.status(403).send({
        success: false,
        error: { code: 'INVALID_ADAPTER_TOKEN', message: 'Invalid adapter token' },
      });
      return;
    }
    request.adapterToken = token;
  };

  const deriveLeaseOwner = (request: any, channel: string | null): string => {
    const token = String(request?.adapterToken || '').trim();
    const digest = createHash('sha256').update(token).digest('hex').slice(0, 16);
    const normalizedChannel = String(channel || '').trim() || 'all';
    return `${normalizedChannel}:${digest}`;
  };

  // Subscribe to outbox.enqueue and persist
  const js = nc.jetstream();

  // ─── GET /v1/outbox/next ───
  // Adapters poll for the next message to deliver.
  app.get('/v1/outbox/next', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const query = request.query as { channel?: string; limit?: string };
    const channel = query.channel;
    const limitRaw = query.limit;
    const limitParsed = limitRaw === undefined ? 10 : Number.parseInt(String(limitRaw), 10);
    if (!Number.isFinite(limitParsed) || !Number.isInteger(limitParsed) || limitParsed < 1) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 50' },
      });
      return;
    }
    const limit = Math.min(limitParsed, 50);

    const leaseOwner = deriveLeaseOwner(request, channel || null);
    const result = await pool.query(
      `WITH candidates AS (
         SELECT id
         FROM outbox
         WHERE ($1::text IS NULL OR channel = $1)
           AND (
             status = 'pending'
             OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= NOW())
           )
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       ),
       claimed AS (
         UPDATE outbox o
         SET status = 'processing',
             lease_owner = $3,
             lease_expires_at = NOW() + make_interval(secs => $4::int),
             delivery_attempts = COALESCE(o.delivery_attempts, 0) + 1,
             updated_at = NOW()
         FROM candidates c
         WHERE o.id = c.id
         RETURNING o.*
       )
       SELECT * FROM claimed ORDER BY created_at ASC`,
      [channel || null, limit, leaseOwner, OUTBOX_LEASE_SECONDS],
    );
    reply.send({ success: true, data: { items: result.rows } });
  });

  // ─── POST /v1/outbox/:id/sent ───
  app.post('/v1/outbox/:id/sent', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const channel = extractAckChannel(request);
    if (!channel) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel is required' },
      });
    }
    const leaseOwner = deriveLeaseOwner(request, channel);
    const result = await pool.query(
      `UPDATE outbox
       SET status = 'sent',
           sent_at = NOW(),
           lease_owner = NULL,
           lease_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND channel = $2
         AND (
           (status = 'pending' AND COALESCE(lease_owner, '') = '')
           OR (status = 'processing' AND lease_owner = $3)
         )`,
      [id, channel, leaseOwner],
    );
    if (result.rowCount === 0) {
      return respondOutboxMutationMiss(reply, id, channel);
    }
    logger.info('Outbox item marked sent', { outbox_id: id, channel });
    reply.send({ success: true });
  });

  // ─── POST /v1/outbox/:id/error ───
  app.post('/v1/outbox/:id/error', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodyParsed = normalizeOutboxBody<{ channel?: string; error?: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const channel = extractAckChannel(request);
    if (!channel) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel is required' },
      });
    }
    const leaseOwner = deriveLeaseOwner(request, channel);
    const result = await pool.query(
      `UPDATE outbox
       SET status = 'error',
           error = $2,
           lease_owner = NULL,
           lease_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND channel = $3
         AND (
           (status = 'pending' AND COALESCE(lease_owner, '') = '')
           OR (status = 'processing' AND lease_owner = $4)
         )`,
      [id, body.error || 'Unknown error', channel, leaseOwner],
    );
    if (result.rowCount === 0) {
      return respondOutboxMutationMiss(reply, id, channel);
    }
    logger.warn('Outbox item errored', { outbox_id: id, channel, error: body.error });
    reply.send({ success: true });
  });
}
