// ---------------------------------------------------------------------------
// Lightweight CORS hook for Fastify — no external dependency.
// Usage: app.addHook('onRequest', corsHook({ origin: 'https://market.sven.systems' }));
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from 'fastify';

export interface CorsOptions {
  /** Allowed origin(s). '*' allows any origin. Can be a string or array. */
  origin?: string | string[];
  /** Allowed HTTP methods. Defaults to common REST methods. */
  methods?: string[];
  /** Allowed headers. Defaults to common request headers. */
  allowedHeaders?: string[];
  /** Whether to include credentials (cookies, auth headers). Default true. */
  credentials?: boolean;
  /** Max age for preflight cache in seconds. Default 86400 (24h). */
  maxAge?: number;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept'];

function resolveOrigin(opts: CorsOptions): string | string[] {
  if (opts.origin) return opts.origin;
  const env = process.env.CORS_ORIGIN;
  if (env) {
    return env.includes(',') ? env.split(',').map(s => s.trim()) : env;
  }
  return '*';
}

function isOriginAllowed(requestOrigin: string | undefined, allowed: string | string[]): boolean {
  if (!requestOrigin) return false;
  if (allowed === '*') return true;
  if (typeof allowed === 'string') return requestOrigin === allowed;
  return allowed.includes(requestOrigin);
}

export function corsHook(opts: CorsOptions = {}) {
  const allowedOrigin = resolveOrigin(opts);
  const methods = (opts.methods ?? DEFAULT_METHODS).join(', ');
  const headers = (opts.allowedHeaders ?? DEFAULT_HEADERS).join(', ');
  const credentials = opts.credentials !== false;
  const maxAge = String(opts.maxAge ?? 86400);

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requestOrigin = req.headers.origin;

    // Determine the value for Access-Control-Allow-Origin
    let originHeader: string;
    if (allowedOrigin === '*' && !credentials) {
      originHeader = '*';
    } else if (allowedOrigin === '*') {
      // With credentials, reflect the request origin instead of '*'
      originHeader = requestOrigin || '*';
    } else if (isOriginAllowed(requestOrigin, allowedOrigin)) {
      originHeader = requestOrigin!;
    } else if (!requestOrigin) {
      // Non-browser requests (curl, server-to-server) — allow through
      return;
    } else {
      // Origin not in allowlist — still set Vary but don't set Allow-Origin
      reply.header('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        reply.code(403).send();
        return;
      }
      return;
    }

    reply.header('Access-Control-Allow-Origin', originHeader);
    reply.header('Vary', 'Origin');

    if (credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    // Preflight
    if (req.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', methods);
      reply.header('Access-Control-Allow-Headers', headers);
      reply.header('Access-Control-Max-Age', maxAge);
      reply.code(204).send();
      return;
    }
  };
}
