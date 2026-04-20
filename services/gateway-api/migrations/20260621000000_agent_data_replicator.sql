CREATE TABLE IF NOT EXISTS agent_data_replicator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  source_config JSONB NOT NULL DEFAULT '{}',
  target_config JSONB NOT NULL DEFAULT '{}',
  replication_mode TEXT NOT NULL DEFAULT 'async',
  conflict_resolution TEXT NOT NULL DEFAULT 'last_write_wins',
  sync_interval_seconds INTEGER NOT NULL DEFAULT 300,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_data_replicator_configs_agent ON agent_data_replicator_configs(agent_id);
CREATE INDEX idx_agent_data_replicator_configs_enabled ON agent_data_replicator_configs(enabled);
