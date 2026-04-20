-- Batch 266: NetFlow Exporter
CREATE TABLE IF NOT EXISTS agent_netflow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  exporter_name VARCHAR(255) NOT NULL,
  source_interface VARCHAR(255) NOT NULL,
  collector_address VARCHAR(255) NOT NULL,
  collector_port INTEGER DEFAULT 2055,
  version INTEGER DEFAULT 9,
  template_refresh_sec INTEGER DEFAULT 600,
  active_timeout_sec INTEGER DEFAULT 1800,
  inactive_timeout_sec INTEGER DEFAULT 15,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_netflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_netflow_configs(id),
  template_id INTEGER NOT NULL,
  template_name VARCHAR(255),
  field_count INTEGER DEFAULT 0,
  fields JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_netflow_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_netflow_configs(id),
  period_start TIMESTAMPTZ NOT NULL,
  flows_exported BIGINT DEFAULT 0,
  packets_sent BIGINT DEFAULT 0,
  template_refreshes INTEGER DEFAULT 0,
  export_errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_netflow_configs_agent ON agent_netflow_configs(agent_id);
CREATE INDEX idx_netflow_templates_config ON agent_netflow_templates(config_id);
CREATE INDEX idx_netflow_stats_config ON agent_netflow_stats(config_id);
