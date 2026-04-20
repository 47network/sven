-- Batch 315: Data Lakehouse vertical
CREATE TABLE IF NOT EXISTS agent_lakehouse_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  format TEXT NOT NULL DEFAULT 'iceberg' CHECK (format IN ('iceberg','delta','hudi','parquet')),
  storage_path TEXT NOT NULL DEFAULT 's3://sven-lakehouse',
  catalog_type TEXT NOT NULL DEFAULT 'hive',
  compaction_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_lakehouse_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_lakehouse_configs(id),
  table_name TEXT NOT NULL,
  partition_columns TEXT[] NOT NULL DEFAULT '{}',
  file_count INTEGER NOT NULL DEFAULT 0,
  row_count BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  last_compacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_lakehouse_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES agent_lakehouse_tables(id),
  snapshot_id BIGINT NOT NULL,
  parent_snapshot_id BIGINT,
  operation TEXT NOT NULL,
  added_files INTEGER NOT NULL DEFAULT 0,
  deleted_files INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lakehouse_configs_agent ON agent_lakehouse_configs(agent_id);
CREATE INDEX idx_lakehouse_tables_config ON agent_lakehouse_tables(config_id);
CREATE INDEX idx_lakehouse_snapshots_table ON agent_lakehouse_snapshots(table_id);
