import type { HealthStatus, HealthCheck } from './types/api.js';

const startTime = Date.now();

/**
 * Build a health status response. Each service provides its own checks.
 */
export function buildHealthStatus(
  service: string,
  version: string,
  checks: HealthCheck[],
): HealthStatus {
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  return {
    status: hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy',
    service,
    version,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}
