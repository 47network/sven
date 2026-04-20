-- Batch 314: Analytics Engine vertical
CREATE TABLE IF NOT EXISTS agent_analytics_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  engine_type TEXT NOT NULL DEFAULT 'clickhouse' CHECK (engine_type IN ('clickhouse','druid','pinot','duckdb')),
  retention_days INTEGER NOT NULL DEFAULT 365,
  compression TEXT NOT NULL DEFAULT 'lz4',
  partition_by TEXT NOT NULL DEFAULT 'month',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_analytics_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_analytics_configs(id),
  dataset_name TEXT NOT NULL,
  row_count BIGINT NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  schema_def JSONB NOT NULL DEFAULT '{}',
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_analytics_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES agent_analytics_datasets(id),
  query_sql TEXT NOT NULL,
  result_rows INTEGER NOT NULL DEFAULT 0,
  scan_bytes BIGINT NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_configs_agent ON agent_analytics_configs(agent_id);
CREATE INDEX idx_analytics_datasets_config ON agent_analytics_datasets(config_id);
CREATE INDEX idx_analytics_queries_dataset ON agent_analytics_queries(dataset_id);
