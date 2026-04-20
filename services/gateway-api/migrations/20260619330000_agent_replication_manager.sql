-- Batch 296: Replication Manager
CREATE TABLE IF NOT EXISTS agent_repl_mgr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  repl_type TEXT NOT NULL DEFAULT 'streaming',
  primary_host TEXT,
  max_replicas INTEGER DEFAULT 3,
  sync_mode TEXT NOT NULL DEFAULT 'async',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_repl_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_repl_mgr_configs(id),
  node_name TEXT NOT NULL,
  host TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'replica',
  state TEXT NOT NULL DEFAULT 'initializing',
  lag_bytes BIGINT DEFAULT 0,
  lag_seconds DOUBLE PRECISION DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_repl_failovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_repl_mgr_configs(id),
  old_primary TEXT NOT NULL,
  new_primary TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'automatic',
  state TEXT NOT NULL DEFAULT 'initiated',
  data_loss_bytes BIGINT DEFAULT 0,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_repl_mgr_configs_agent ON agent_repl_mgr_configs(agent_id);
CREATE INDEX idx_repl_nodes_config ON agent_repl_nodes(config_id);
CREATE INDEX idx_repl_failovers_config ON agent_repl_failovers(config_id);
