export type MetricType = 'gauge' | 'counter' | 'histogram' | 'summary';
export type ExportFormat = 'prometheus' | 'openmetrics' | 'json' | 'statsd';
export type ComparisonOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export interface AgentMetricsHubConfig {
  id: string;
  agentId: string;
  name: string;
  scrapeIntervalSeconds: number;
  retentionDays: number;
  aggregationWindow: string;
  exportFormat: ExportFormat;
  labels: Record<string, string>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMetricSeries {
  id: string;
  configId: string;
  metricName: string;
  metricType: MetricType;
  unit?: string;
  description?: string;
  currentValue?: number;
  minValue?: number;
  maxValue?: number;
  sampleCount: number;
  labels: Record<string, string>;
  lastUpdatedAt?: Date;
  createdAt: Date;
}

export interface AgentMetricRule {
  id: string;
  configId: string;
  ruleName: string;
  expression: string;
  threshold?: number;
  comparison: ComparisonOp;
  durationSeconds: number;
  severity: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
