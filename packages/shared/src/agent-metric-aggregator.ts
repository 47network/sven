export type AggregationInterval = '10s' | '30s' | '1m' | '5m' | '15m' | '1h';
export type MetricType = 'gauge' | 'counter' | 'histogram' | 'summary' | 'rate';
export type RollupPeriod = '1m' | '5m' | '1h' | '1d' | '7d' | '30d';
export type MetricUnit = 'ms' | 'bytes' | 'percent' | 'count' | 'ops_per_sec';

export interface MetricAggregatorConfig {
  id: string;
  agentId: string;
  aggregationInterval: AggregationInterval;
  retentionDays: number;
  flushThreshold: number;
  dimensions: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMetric {
  id: string;
  configId: string;
  agentId: string;
  metricName: string;
  metricType: MetricType;
  value: number;
  unit: MetricUnit | null;
  dimensions: Record<string, string>;
  timestamp: Date;
  createdAt: Date;
}

export interface MetricRollup {
  id: string;
  configId: string;
  metricName: string;
  period: RollupPeriod;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  sumValue: number | null;
  count: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}
