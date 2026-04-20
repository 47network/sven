CREATE TABLE IF NOT EXISTS agent_volume_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  storage_class TEXT NOT NULL DEFAULT 'standard',
  reclaim_policy TEXT NOT NULL DEFAULT 'retain',
  max_size_gb INTEGER NOT NULL DEFAULT 100,
  snapshot_enabled BOOLEAN NOT NULL DEFAULT true,
  encryption_at_rest BOOLEAN NOT NULL DEFAULT true,
  backup_schedule TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_volume_manager_agent ON agent_volume_manager_configs(agent_id);
CREATE INDEX idx_volume_manager_enabled ON agent_volume_manager_configs(enabled);
