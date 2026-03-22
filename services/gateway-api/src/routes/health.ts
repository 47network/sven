import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';
import { buildHealthStatus } from '@sven/shared';
import { API_CONTRACT_SURFACES, API_CONTRACT_VERSION } from '../contracts/api-contract.js';

const VERSION = '0.1.0';
const DEFAULT_HEALTH_CACHE_TTL_MS = 1000;
const MIN_HEALTH_CACHE_TTL_MS = 100;
const MAX_HEALTH_CACHE_TTL_MS = 60000;

export function normalizeHealthCacheTtlMs(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_HEALTH_CACHE_TTL_MS;
  }
  const normalized = Math.floor(parsed);
  return Math.max(MIN_HEALTH_CACHE_TTL_MS, Math.min(MAX_HEALTH_CACHE_TTL_MS, normalized));
}

export function getPublicHealthFailureMessage(checkName: 'postgres' | 'nats'): string {
  if (checkName === 'postgres') return 'Dependency check failed: postgres_unavailable';
  return 'Dependency check failed: nats_unavailable';
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  const cacheTtlRaw = process.env.HEALTH_CACHE_TTL_MS;
  const cacheTtlMs = normalizeHealthCacheTtlMs(cacheTtlRaw);
  if (
    cacheTtlRaw !== undefined
    && (
      !Number.isFinite(Number(cacheTtlRaw))
      || Number(cacheTtlRaw) <= 0
      || Math.floor(Number(cacheTtlRaw)) !== cacheTtlMs
    )
  ) {
    console.warn(`[HEALTH] Invalid HEALTH_CACHE_TTL_MS="${cacheTtlRaw}" normalized to ${cacheTtlMs}ms`);
  }
  let cachedHealthAt = 0;
  let cachedHealthPayload: any = null;
  let healthInFlight: Promise<any> | null = null;

  const computeHealth = async () => {
    const checks = [];

    // Check Postgres
    const pgStart = Date.now();
    try {
      await pool.query('SELECT 1');
      checks.push({ name: 'postgres', status: 'pass' as const, duration_ms: Date.now() - pgStart });
    } catch (err) {
      console.warn('[HEALTH] Postgres check failed', { error: String(err) });
      checks.push({
        name: 'postgres',
        status: 'fail' as const,
        message: getPublicHealthFailureMessage('postgres'),
        duration_ms: Date.now() - pgStart,
      });
    }

    // Check NATS
    const natsStart = Date.now();
    try {
      const timeoutMs = Number(process.env.HEALTH_NATS_TIMEOUT_MS || 1000);
      const flushOk = await Promise.race([
        nc.flush().then(() => true).catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
      const ok = !nc.isClosed() && flushOk;
      checks.push({
        name: 'nats',
        status: ok ? ('pass' as const) : ('fail' as const),
        duration_ms: Date.now() - natsStart,
      });
    } catch (err) {
      console.warn('[HEALTH] NATS check failed', { error: String(err) });
      checks.push({
        name: 'nats',
        status: 'fail' as const,
        message: getPublicHealthFailureMessage('nats'),
        duration_ms: Date.now() - natsStart,
      });
    }

    return buildHealthStatus('gateway-api', VERSION, checks);
  };

  const getHealth = async () => {
    const now = Date.now();
    if (cachedHealthPayload && now - cachedHealthAt < cacheTtlMs) {
      return cachedHealthPayload;
    }
    if (healthInFlight) {
      return healthInFlight;
    }
    healthInFlight = computeHealth()
      .then((payload) => {
        cachedHealthPayload = payload;
        cachedHealthAt = Date.now();
        return payload;
      })
      .finally(() => {
        healthInFlight = null;
      });
    return healthInFlight;
  };

  app.get('/healthz', async (_req, reply) => {
    reply.header('x-api-contract-version', API_CONTRACT_VERSION);
    const health = await getHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    reply.status(statusCode).send(health);
  });

  // Readiness probe
  app.get('/readyz', async (_req, reply) => {
    reply.header('x-api-contract-version', API_CONTRACT_VERSION);
    const health = await getHealth();
    const pgCheck = Array.isArray(health?.checks)
      ? health.checks.find((c: any) => c?.name === 'postgres')
      : null;
    const natsCheck = Array.isArray(health?.checks)
      ? health.checks.find((c: any) => c?.name === 'nats')
      : null;
    const ready = Boolean(
      pgCheck && pgCheck.status === 'pass'
      && natsCheck && natsCheck.status === 'pass',
    );
    reply.status(ready ? 200 : 503).send({ ready });
  });

  // Public contract version endpoint for clients/CI to validate API boundary compatibility.
  app.get('/v1/contracts/version', async (_req, reply) => {
    reply.send({
      success: true,
      data: {
        version: API_CONTRACT_VERSION,
        surfaces: API_CONTRACT_SURFACES,
      },
    });
  });
}
