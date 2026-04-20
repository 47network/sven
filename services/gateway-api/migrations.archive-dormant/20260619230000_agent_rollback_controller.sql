-- Batch 286: Rollback Controller
CREATE TABLE IF NOT EXISTS agent_rollback_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  auto_rollback BOOLEAN DEFAULT true,
  max_rollback_depth INTEGER DEFAULT 3,
  health_threshold NUMERIC(5,2) DEFAULT 95.00,
  cooldown_minutes INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_rollback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_rollback_configs(id),
  deployment_id UUID,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'automatic',
  state TEXT NOT NULL DEFAULT 'initiated',
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_rollback_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES agent_rollback_events(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  snapshot_data JSONB DEFAULT '{}',
  restored BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rollback_configs_agent ON agent_rollback_configs(agent_id);
CREATE INDEX idx_rollback_events_config ON agent_rollback_events(config_id);
CREATE INDEX idx_rollback_snapshots_event ON agent_rollback_snapshots(event_id);
