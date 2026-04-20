/* Batch 129 — Agent Health Monitoring */

export type HealthCheckType = 'http' | 'tcp' | 'dns' | 'grpc' | 'custom';

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealthCheck {
  id: string;
  agentId: string;
  checkName: string;
  checkType: HealthCheckType;
  targetUrl: string;
  intervalSecs: number;
  timeoutMs: number;
  expectedStatus?: number;
  enabled: boolean;
  lastStatus?: ServiceHealthStatus;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface HealthEvent {
  id: string;
  checkId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseMs?: number;
  statusCode?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  recordedAt: string;
}

export interface UptimeRecord {
  id: string;
  checkId: string;
  periodStart: string;
  periodEnd: string;
  uptimePct: number;
  totalChecks: number;
  failedChecks: number;
  avgResponseMs?: number;
  slaTargetPct: number;
}

export interface HealthMonitoringStats {
  totalChecks: number;
  healthyChecks: number;
  degradedChecks: number;
  unhealthyChecks: number;
  avgUptimePct: number;
}
