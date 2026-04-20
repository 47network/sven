-- Batch 264: Flow Collector
CREATE TABLE IF NOT EXISTS agent_flow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  collector_name VARCHAR(255) NOT NULL,
  listen_port INTEGER DEFAULT 2055,
  protocol VARCHAR(50) DEFAULT 'netflow_v9',
  sampling_rate INTEGER DEFAULT 1,
  aggregation_interval_sec INTEGER DEFAULT 60,
  retention_days INTEGER DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_flow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_flow_configs(id),
  source_ip VARCHAR(50) NOT NULL,
  dest_ip VARCHAR(50) NOT NULL,
  source_port INTEGER,
  dest_port INTEGER,
  protocol INTEGER,
  bytes_total BIGINT DEFAULT 0,
  packets_total BIGINT DEFAULT 0,
  flow_start TIMESTAMPTZ NOT NULL,
  flow_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_flow_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_flow_configs(id),
  report_type VARCHAR(50) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  top_talkers JSONB DEFAULT '[]',
  protocol_breakdown JSONB DEFAULT '{}',
  total_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flow_configs_agent ON agent_flow_configs(agent_id);
CREATE INDEX idx_flow_records_config ON agent_flow_records(config_id);
CREATE INDEX idx_flow_reports_config ON agent_flow_reports(config_id);
