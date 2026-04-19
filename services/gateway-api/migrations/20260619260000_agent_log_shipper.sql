-- Batch 289: Log Shipper
CREATE TABLE IF NOT EXISTS agent_log_ship_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  destination TEXT NOT NULL DEFAULT 'opensearch',
  log_level TEXT NOT NULL DEFAULT 'info',
  buffer_size INTEGER DEFAULT 1000,
  flush_interval_seconds INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_log_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_ship_configs(id),
  pipeline_name TEXT NOT NULL,
  source TEXT NOT NULL,
  filters JSONB DEFAULT '[]',
  transforms JSONB DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'running',
  throughput_eps DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_log_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_ship_configs(id),
  dest_type TEXT NOT NULL DEFAULT 'opensearch',
  connection_url TEXT,
  index_pattern TEXT DEFAULT 'logs-%Y.%m.%d',
  healthy BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_log_ship_configs_agent ON agent_log_ship_configs(agent_id);
CREATE INDEX idx_log_pipelines_config ON agent_log_pipelines(config_id);
CREATE INDEX idx_log_destinations_config ON agent_log_destinations(config_id);
