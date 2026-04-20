export type AnalyticsEngineType = 'clickhouse' | 'druid' | 'pinot' | 'duckdb';

export interface AgentAnalyticsConfig {
  id: string; agent_id: string; engine_type: AnalyticsEngineType; retention_days: number;
  compression: string; partition_by: string; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface AgentAnalyticsDataset {
  id: string; config_id: string; dataset_name: string; row_count: number;
  column_count: number; size_bytes: number; schema_def: Record<string, unknown>;
  last_ingested_at?: string; created_at: string;
}

export interface AgentAnalyticsQuery {
  id: string; dataset_id: string; query_sql: string; result_rows: number;
  scan_bytes: number; duration_ms: number; cached: boolean; created_at: string;
}
