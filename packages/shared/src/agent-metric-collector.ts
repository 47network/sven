export type MetricSourceType = 'prometheus' | 'statsd' | 'opentelemetry' | 'cloudwatch' | 'custom' | 'graphite';
export type MetricSourceStatus = 'active' | 'paused' | 'disabled' | 'error' | 'initializing';
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'distribution';
export type MetricAlertSeverity = 'critical' | 'warning' | 'info';
export type MetricAlertStatus = 'active' | 'firing' | 'resolved' | 'silenced' | 'disabled';

export interface MetricSource {
  id: string;
  agent_id: string;
  source_name: string;
  source_type: MetricSourceType;
  status: MetricSourceStatus;
  scrape_interval_seconds: number;
  endpoint?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MetricSeries {
  id: string;
  source_id: string;
  metric_name: string;
  metric_type: MetricType;
  labels: Record<string, string>;
  value: number;
  timestamp: string;
}

export interface MetricAlert {
  id: string;
  agent_id: string;
  alert_name: string;
  condition: string;
  threshold: number;
  severity: MetricAlertSeverity;
  status: MetricAlertStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
