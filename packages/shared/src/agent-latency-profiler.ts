export interface LatencyProfilerConfig {
  id: string;
  agentId: string;
  endpointUrl: string;
  percentiles: number[];
  sampleRate: number;
  baselineP99Ms: number;
  alertThresholdMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface LatencyProfile {
  endpointUrl: string;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  sampleCount: number;
  period: string;
}
export interface LatencyAnomaly {
  endpointUrl: string;
  expectedP99Ms: number;
  actualP99Ms: number;
  severity: string;
  detectedAt: string;
}
