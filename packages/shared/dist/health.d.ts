import type { HealthStatus, HealthCheck } from './types/api.js';
/**
 * Build a health status response. Each service provides its own checks.
 */
export declare function buildHealthStatus(service: string, version: string, checks: HealthCheck[]): HealthStatus;
//# sourceMappingURL=health.d.ts.map