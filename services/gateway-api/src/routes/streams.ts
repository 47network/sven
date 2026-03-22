import { EventEmitter } from 'node:events';
import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

type StreamEvent = {
  id: string;
  type: string;
  data: unknown;
  dataBytes: number;
  createdAt: number;
};

type StreamState = {
  id: string;
  ownerUserId: string;
  ownerOrgId: string;
  createdAt: number;
  updatedAt: number;
  ttlMs: number;
  seq: number;
  activeSubscribers: number;
  totalEventBytes: number;
  events: StreamEvent[];
};

const DEFAULT_TTL_MS = normalizeStreamConfigInteger(process.env.STREAM_RESUME_TTL_MS, 120_000, 10_000, 600_000);
const CLEANUP_INTERVAL_MS = normalizeStreamConfigInteger(process.env.STREAM_RESUME_CLEANUP_MS, 30_000, 1_000, 300_000);
const MAX_EVENT_DATA_BYTES = normalizeStreamConfigInteger(process.env.STREAM_RESUME_MAX_EVENT_DATA_BYTES, 64 * 1024, 1_024, 1_048_576);
const MAX_STREAM_EVENT_BYTES = normalizeStreamConfigInteger(process.env.STREAM_RESUME_MAX_STREAM_EVENT_BYTES, 1024 * 1024, 64 * 1024, 16 * 1024 * 1024);
const MAX_EVENTS_PER_STREAM = normalizeStreamConfigInteger(process.env.STREAM_RESUME_MAX_EVENTS, 500, 1, 5_000);

const streams = new Map<string, StreamState>();
const streamBus = new EventEmitter();
let cleanupTimer: NodeJS.Timeout | null = null;
const logger = createLogger('gateway-streams');

export async function registerStreamRoutes(app: FastifyInstance, pool: pg.Pool) {
  const authenticated = requireRole(pool, 'admin', 'user');
  ensureCleanupLoop();

  app.post('/v1/streams', { preHandler: authenticated }, async (request, reply) => {
    const ownerUserId = String((request as any).userId || '').trim();
    const ownerOrgId = String((request as any).orgId || '').trim();
    if (!ownerUserId || !ownerOrgId) {
      logger.warn('Denied stream create due to missing active account context', {
        route: '/v1/streams',
        actor_user_id: ownerUserId || null,
        actor_org_id: ownerOrgId || null,
      });
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const body = (request.body || {}) as { ttl_ms?: number };
    const ttlMs = parseOptionalStreamTtlMs(body.ttl_ms, DEFAULT_TTL_MS);
    if (ttlMs === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'ttl_ms must be an integer between 10000 and 600000' },
      });
      return;
    }
    const id = uuidv7();
    streams.set(id, {
      id,
      ownerUserId,
      ownerOrgId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ttlMs,
      seq: 0,
      activeSubscribers: 0,
      totalEventBytes: 0,
      events: [],
    });
    reply.status(201).send({ success: true, data: { stream_id: id, ttl_ms: ttlMs } });
  });

  app.post('/v1/streams/:id/events', { preHandler: authenticated }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { type?: string; data?: unknown };
    const stream = streams.get(id);
    if (!stream) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Stream not found' } });
      return;
    }
    if (!isStreamOwnerMatch(stream, request as any)) {
      auditDeniedStreamAccess(stream, request as any, '/v1/streams/:id/events');
      reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Stream access denied' } });
      return;
    }
    const dataBytes = getSerializedDataBytes(body.data ?? null);
    if (!Number.isFinite(dataBytes) || dataBytes > MAX_EVENT_DATA_BYTES) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `event data exceeds max size (${MAX_EVENT_DATA_BYTES} bytes)`,
        },
      });
      return;
    }

    stream.seq += 1;
    stream.updatedAt = Date.now();
    const ev: StreamEvent = {
      id: String(stream.seq),
      type: String(body.type || 'message'),
      data: body.data ?? null,
      dataBytes,
      createdAt: Date.now(),
    };
    stream.events.push(ev);
    stream.totalEventBytes += ev.dataBytes;
    if (stream.events.length > MAX_EVENTS_PER_STREAM) {
      const removed = stream.events.splice(0, stream.events.length - MAX_EVENTS_PER_STREAM);
      for (const item of removed) {
        stream.totalEventBytes -= item.dataBytes;
      }
    }
    while (stream.totalEventBytes > MAX_STREAM_EVENT_BYTES && stream.events.length > 0) {
      const removed = stream.events.shift();
      if (!removed) break;
      stream.totalEventBytes -= removed.dataBytes;
    }
    streamBus.emit(id, ev);
    reply.send({ success: true, data: { event_id: ev.id } });
  });

  app.get('/v1/streams/:id/events', { preHandler: authenticated }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = (request.query || {}) as { after?: string; limit?: string };
    const stream = streams.get(id);
    if (!stream) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Stream not found' } });
      return;
    }
    if (!isStreamOwnerMatch(stream, request as any)) {
      auditDeniedStreamAccess(stream, request as any, '/v1/streams/:id/events [read]');
      reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Stream access denied' } });
      return;
    }
    const after = parseOptionalNonNegativeInteger(query.after, 0);
    if (after === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'after must be a non-negative integer' },
      });
      return;
    }
    const limit = parseOptionalPositiveInteger(query.limit, 50, 200);
    if (limit === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 200' },
      });
      return;
    }
    const data = stream.events.filter((e) => Number(e.id) > after).slice(0, limit);
    reply.send({ success: true, data });
  });

  app.get('/v1/streams/:id/sse', { preHandler: authenticated }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const stream = streams.get(id);
    if (!stream) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Stream not found' } });
      return;
    }
    if (!isStreamOwnerMatch(stream, request as any)) {
      auditDeniedStreamAccess(stream, request as any, '/v1/streams/:id/sse');
      reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Stream access denied' } });
      return;
    }

    stream.updatedAt = Date.now();
    const query = (request.query || {}) as { last_event_id?: string };
    const headerLastId = String(request.headers['last-event-id'] || '');
    const lastEventId = parseOptionalNonNegativeInteger(query.last_event_id || headerLastId, 0);
    if (lastEventId === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'last_event_id must be a non-negative integer' },
      });
      return;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (ev: StreamEvent) => {
      reply.raw.write(`id: ${ev.id}\n`);
      reply.raw.write(`event: ${ev.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(ev.data)}\n\n`);
    };

    for (const ev of stream.events) {
      if (Number(ev.id) > lastEventId) sendEvent(ev);
    }

    const listener = (ev: StreamEvent) => sendEvent(ev);
    streamBus.on(id, listener);
    stream.activeSubscribers += 1;

    const keepAlive = setInterval(() => {
      stream.updatedAt = Date.now();
      reply.raw.write(': keepalive\n\n');
    }, 15_000);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(keepAlive);
      streamBus.off(id, listener);
      stream.activeSubscribers = Math.max(0, stream.activeSubscribers - 1);
      stream.updatedAt = Date.now();
    };

    request.raw.on('close', cleanup);
    reply.raw.on('close', cleanup);
    reply.raw.on('error', cleanup);
  });
}

function ensureCleanupLoop() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, stream] of streams.entries()) {
      if (shouldEvictStream(stream, now)) {
        streams.delete(id);
        streamBus.removeAllListeners(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

function isStreamOwnerMatch(stream: StreamState, request: any): boolean {
  const userId = String(request?.userId || '').trim();
  const orgId = String(request?.orgId || '').trim();
  return Boolean(userId && orgId)
    && stream.ownerUserId === userId
    && stream.ownerOrgId === orgId;
}

function auditDeniedStreamAccess(stream: StreamState, request: any, route: string): void {
  const actorUserId = String(request?.userId || '').trim();
  const actorOrgId = String(request?.orgId || '').trim();
  logger.warn('Denied stream access due to ownership mismatch', {
    route,
    stream_id: stream.id,
    actor_user_id: actorUserId || null,
    actor_org_id: actorOrgId || null,
    stream_owner_user_id: stream.ownerUserId,
    stream_owner_org_id: stream.ownerOrgId,
  });
}

export function shouldEvictStream(stream: Pick<StreamState, 'updatedAt' | 'ttlMs' | 'activeSubscribers'>, now: number): boolean {
  if (stream.activeSubscribers > 0) return false;
  return now - stream.updatedAt > stream.ttlMs;
}

function getSerializedDataBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function parseOptionalNonNegativeInteger(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseOptionalPositiveInteger(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}

function parseOptionalStreamTtlMs(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 10_000 || parsed > 600_000) return null;
  return parsed;
}

export function normalizeStreamConfigInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return Math.trunc(parsed);
}
