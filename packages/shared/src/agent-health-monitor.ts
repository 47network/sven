export type HealthCheckType = 'http' | 'tcp' | 'dns' | 'script' | 'heartbeat' | 'metric_threshold';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type IncidentSeverity = 'info' | 'warning' | 'critical' | 'fatal';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

export interface HealthMonitorConfig {
  id: string;
  agentId: string;
  checkIntervalSeconds: number;
  alertCooldownSeconds: number;
  maxIncidents: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCheck {
  id: string;
  configId: string;
  name: string;
  checkType: HealthCheckType;
  target: string;
  expectedStatus: string;
  currentStatus: HealthStatus;
  lastCheckAt?: Date;
  lastHealthyAt?: Date;
  consecutiveFailures: number;
  configParams: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthIncident {
  id: string;
  checkId: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  startedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
}
