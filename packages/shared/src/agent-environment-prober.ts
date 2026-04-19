export interface EnvironmentProberConfig {
  id: string;
  agentId: string;
  probeType: string;
  targetUrl: string;
  expectedStatus: number;
  timeoutMs: number;
  probeIntervalSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ProbeResult {
  probeId: string;
  targetUrl: string;
  statusCode: number;
  latencyMs: number;
  healthy: boolean;
  checkedAt: string;
  errorMessage?: string;
}
export interface ProbeHistory {
  probeId: string;
  results: ProbeResult[];
  uptimePercent: number;
  avgLatencyMs: number;
}
