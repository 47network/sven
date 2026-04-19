export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface TelemetryCollectorConfig {
  id: string;
  agentId: string;
  collectionIntervalSeconds: number;
  retentionDays: number;
  enabledMetrics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TelemetryMetric {
  id: string;
  configId: string;
  metricName: string;
  metricType: MetricType;
  value: number;
  labels: Record<string, string>;
  recordedAt: string;
}

export interface TelemetryDashboard {
  id: string;
  configId: string;
  name: string;
  panels: Record<string, unknown>[];
  refreshSeconds: number;
  createdAt: string;
}
