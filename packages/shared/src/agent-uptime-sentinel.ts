export type MonitorProtocol = 'http' | 'https' | 'tcp' | 'icmp' | 'dns';
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'unknown';
export type IncidentImpact = 'none' | 'partial' | 'major' | 'total';

export interface UptimeSentinelConfig {
  id: string;
  agentId: string;
  checkIntervalSeconds: number;
  timeoutMs: number;
  alertAfterFailures: number;
  regions: string[];
  metadata: Record<string, unknown>;
}

export interface UptimeMonitor {
  id: string;
  configId: string;
  endpointUrl: string;
  protocol: MonitorProtocol;
  expectedStatus: number;
  currentStatus: MonitorStatus;
  uptimePct: number;
  lastCheckedAt: string | null;
}

export interface UptimeIncident {
  id: string;
  monitorId: string;
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  rootCause: string | null;
  impact: IncidentImpact;
}
