-- Batch 390: Data Sync Engine
CREATE TABLE IF NOT EXISTS agent_data_sync_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  sync_mode TEXT DEFAULT 'incremental' CHECK (sync_mode IN ('full','incremental','bidirectional','mirror')),
  conflict_resolution TEXT DEFAULT 'latest_wins',
  batch_size INT DEFAULT 1000,
  schedule_cron TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_sync_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_sync_engine_configs(id),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_config JSONB NOT NULL,
  destination_type TEXT NOT NULL,
  destination_config JSONB NOT NULL,
  field_mappings JSONB DEFAULT '[]',
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle','syncing','error','paused')),
  last_sync_at TIMESTAMPTZ,
  records_synced BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES agent_sync_connections(id),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_dsync_configs_agent ON agent_data_sync_engine_configs(agent_id);
CREATE INDEX idx_dsync_connections_config ON agent_sync_connections(config_id);
CREATE INDEX idx_dsync_connections_status ON agent_sync_connections(status);
CREATE INDEX idx_dsync_runs_connection ON agent_sync_runs(connection_id);
CREATE INDEX idx_dsync_runs_status ON agent_sync_runs(status);
