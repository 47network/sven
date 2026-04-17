// ---------------------------------------------------------------------------
// Bearer-token API authentication — Fastify onRequest hook (Batch 16)
// ---------------------------------------------------------------------------
// Validates `Authorization: Bearer <token>` on protected routes. Public
// read-only paths (browsing listings, health checks) are exempt. Admin
// operations (refunds, transfers) require an admin token.
//
// Env vars:
//   ECONOMY_API_TOKEN  — required token for write operations
//   ECONOMY_ADMIN_TOKEN — optional separate admin token (falls back to API token)
//
// Usage:
//   import { apiAuthHook } from '@sven/shared';
//   app.addHook('onRequest', apiAuthHook({ adminPaths: ['/v1/market/admin'] }));
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export interface ApiAuthOptions {
  /** Paths that require no auth (exact prefix match). Defaults to health/readyz + GET listing routes. */
  publicPaths?: string[];
  /** Path prefixes requiring admin-level token. */
  adminPaths?: string[];
  /** Env var name for the API token. Default: ECONOMY_API_TOKEN */
  tokenEnvVar?: string;
  /** Env var name for the admin token. Default: ECONOMY_ADMIN_TOKEN */
  adminTokenEnvVar?: string;
}

const DEFAULT_PUBLIC_PATHS = [
  '/health',
  '/healthz',
  '/readyz',
  '/metrics',
];

const DEFAULT_PUBLIC_PREFIXES = [
  '/v1/market/listings',   // browsing listings is public (GET)
  '/v1/eidolon/',          // eidolon snapshot/events are public
];

function isPublicRoute(url: string, method: string, publicPaths: string[]): boolean {
  const path = url.split('?')[0];
  // Exact match exemptions
  for (const p of publicPaths) {
    if (path === p) return true;
  }
  // GET-only public prefixes (browsing)
  if (method === 'GET') {
    for (const prefix of DEFAULT_PUBLIC_PREFIXES) {
      if (path.startsWith(prefix)) return true;
    }
  }
  // OPTIONS (preflight) is always public
  if (method === 'OPTIONS') return true;
  return false;
}

function isAdminRoute(url: string, adminPaths: string[]): boolean {
  const path = url.split('?')[0];
  for (const prefix of adminPaths) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export function apiAuthHook(opts: ApiAuthOptions = {}) {
  const publicPaths = [...DEFAULT_PUBLIC_PATHS, ...(opts.publicPaths ?? [])];
  const adminPaths = opts.adminPaths ?? [];
  const tokenEnvVar = opts.tokenEnvVar ?? 'ECONOMY_API_TOKEN';
  const adminTokenEnvVar = opts.adminTokenEnvVar ?? 'ECONOMY_ADMIN_TOKEN';

  return function authGuard(
    req: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ): void {
    // Public routes skip auth entirely
    if (isPublicRoute(req.url, req.method, publicPaths)) {
      done();
      return;
    }

    const apiToken = process.env[tokenEnvVar];
    // If no token configured, auth is disabled (development mode)
    if (!apiToken) {
      done();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      });
      return;
    }

    const token = authHeader.slice(7);

    // Admin routes need admin token
    if (isAdminRoute(req.url, adminPaths)) {
      const adminToken = process.env[adminTokenEnvVar] || apiToken;
      if (token !== adminToken) {
        reply.code(403).send({
          error: 'forbidden',
          message: 'Admin access required.',
        });
        return;
      }
      done();
      return;
    }

    // Normal write routes need API token
    if (token !== apiToken) {
      reply.code(401).send({
        error: 'unauthorized',
        message: 'Invalid API token.',
      });
      return;
    }

    done();
  };
}
