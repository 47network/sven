// ---------------------------------------------------------------------------
// Correlation ID middleware — Fastify onRequest hook (Batch 16)
// ---------------------------------------------------------------------------
// Extracts `x-correlation-id` from incoming requests or generates a UUID.
// Sets the header on the response so clients can trace requests. Attaches
// the ID to `req.correlationId` for use in downstream logging / NATS events.
//
// Usage:
//   import { correlationIdHook, getCorrelationId } from '@sven/shared';
//   app.addHook('onRequest', correlationIdHook());
//   // In a handler:
//   const cid = getCorrelationId(req);
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { randomUUID } from 'node:crypto';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
  }
}

export interface CorrelationIdOptions {
  /** Header name to read/write. Default: 'x-correlation-id'. */
  header?: string;
  /** Custom ID generator. Default: crypto.randomUUID(). */
  generator?: () => string;
}

export function correlationIdHook(opts: CorrelationIdOptions = {}) {
  const headerName = opts.header ?? 'x-correlation-id';
  const generate = opts.generator ?? randomUUID;

  return function correlationId(
    req: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ): void {
    const existing = req.headers[headerName];
    const id = (typeof existing === 'string' && existing.length > 0) ? existing : generate();
    req.correlationId = id;
    reply.header(headerName, id);
    done();
  };
}

/** Extract the correlation ID set by the hook. */
export function getCorrelationId(req: FastifyRequest): string {
  return req.correlationId ?? 'unknown';
}
