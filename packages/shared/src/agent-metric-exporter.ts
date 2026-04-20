export type MetricFormat = 'prometheus' | 'opentelemetry' | 'statsd' | 'graphite' | 'json';
export type MetricType = 'gauge' | 'counter' | 'histogram' | 'summary';

export interface AgentMetricExpConfig {
  id: string; agent_id: string; export_format: MetricFormat; scrape_interval_seconds: number;
  retention_days: number; endpoints: string[]; status: string; created_at: string; updated_at: string;
}
export interface AgentMetricSeries {
  id: string; config_id: string; metric_name: string; metric_type: MetricType;
  labels: Record<string, string>; value: number; recorded_at: string;
}
export interface AgentMetricAlert {
  id: string; config_id: string; metric_name: string; condition: string;
  threshold: number; severity: string; active: boolean; last_triggered_at: string | null; created_at: string;
}
