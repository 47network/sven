// Batch 350: Health Prober types
export type ProbeType = 'http' | 'tcp' | 'grpc' | 'dns' | 'icmp' | 'custom';
export type ProbeStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'timeout';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type ProbeAlertType = 'down' | 'degraded' | 'latency_spike' | 'cert_expiry' | 'recovered';

export interface HealthProberConfig {
  id: string;
  agentId: string;
  proberName: string;
  targetUrl: string;
  probeType: ProbeType;
  intervalSeconds: number;
  timeoutMs: number;
  successThreshold: number;
  failureThreshold: number;
  expectedStatus: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProbeResult {
  id: string;
  configId: string;
  status: ProbeStatus;
  responseTimeMs?: number;
  statusCode?: number;
  errorMessage?: string;
  headersSnapshot?: Record<string, unknown>;
  bodySnapshot?: string;
  probedAt: Date;
}

export interface ProbeAlert {
  id: string;
  configId: string;
  alertType: ProbeAlertType;
  severity: AlertSeverity;
  message: string;
  consecutiveFailures: number;
  acknowledged: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}
