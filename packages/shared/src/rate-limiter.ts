// ---------------------------------------------------------------------------
// Token-bucket rate limiter — Fastify onRequest hook (Batch 11)
// ---------------------------------------------------------------------------
// Zero-dependency, in-process rate limiter. Each IP gets a bucket that refills
// at a fixed rate. When tokens are exhausted the client receives 429.
//
// Usage:
//   import { rateLimiterHook } from '@sven/shared';
//   app.addHook('onRequest', rateLimiterHook({ max: 100, windowMs: 60_000 }));
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export interface RateLimiterOptions {
  /** Maximum requests per window (default: 100). */
  max?: number;
  /** Window duration in milliseconds (default: 60 000 — 1 minute). */
  windowMs?: number;
  /** Paths to skip (exact match). Defaults to ['/health', '/healthz', '/readyz']. */
  skipPaths?: string[];
  /** Custom key extractor. Defaults to request IP. */
  keyExtractor?: (req: FastifyRequest) => string;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export function rateLimiterHook(opts: RateLimiterOptions = {}) {
  const max = opts.max ?? 100;
  const windowMs = opts.windowMs ?? 60_000;
  const skipPaths = new Set(opts.skipPaths ?? ['/health', '/healthz', '/readyz']);
  const keyExtractor = opts.keyExtractor ?? ((req: FastifyRequest) => req.ip);

  const buckets = new Map<string, Bucket>();

  // Periodic cleanup to prevent unbounded memory growth
  const CLEANUP_INTERVAL = 5 * 60_000;
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > windowMs * 2) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL);
  if (cleanup.unref) cleanup.unref();

  return function rateLimit(
    req: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ): void {
    if (skipPaths.has(req.url.split('?')[0])) {
      done();
      return;
    }

    const key = keyExtractor(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: max, lastRefill: now };
      buckets.set(key, bucket);
    }

    // Refill tokens proportionally to elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const refill = Math.floor((elapsed / windowMs) * max);
      if (refill > 0) {
        bucket.tokens = Math.min(max, bucket.tokens + refill);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil(windowMs / 1000);
      reply
        .code(429)
        .header('Retry-After', String(retryAfter))
        .header('X-RateLimit-Limit', String(max))
        .header('X-RateLimit-Remaining', '0')
        .send({
          error: 'too_many_requests',
          message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
          retryAfterSec: retryAfter,
        });
      return;
    }

    bucket.tokens -= 1;
    reply.header('X-RateLimit-Limit', String(max));
    reply.header('X-RateLimit-Remaining', String(bucket.tokens));

    done();
  };
}
