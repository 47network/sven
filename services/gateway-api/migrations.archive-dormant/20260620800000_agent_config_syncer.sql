CREATE TABLE IF NOT EXISTS agent_config_syncer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  config_key VARCHAR(500) NOT NULL,
  sync_interval_seconds INTEGER DEFAULT 300,
  source_type VARCHAR(100) NOT NULL,
  last_synced_at TIMESTAMPTZ,
  conflict_resolution VARCHAR(50) DEFAULT 'latest_wins',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_config_syncer_configs_agent ON agent_config_syncer_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_config_syncer_configs_enabled ON agent_config_syncer_configs(enabled);
