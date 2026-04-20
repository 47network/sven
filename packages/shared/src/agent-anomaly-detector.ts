export interface AnomalyDetectorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  detectionModel: string;
  sensitivity: number;
  baselineWindow: string;
  alertThreshold: number;
  metricPatterns: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedAnomaly {
  id: string;
  configId: string;
  metricName: string;
  expectedValue: number;
  actualValue: number;
  deviationScore: number;
  severity: string;
  detectedAt: string;
}

export interface AnomalyBaseline {
  id: string;
  configId: string;
  metricName: string;
  mean: number;
  stdDev: number;
  sampleCount: number;
  windowStart: string;
  windowEnd: string;
}
