-- Batch 265: sFlow Agent
CREATE TABLE IF NOT EXISTS agent_sflow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  sflow_name VARCHAR(255) NOT NULL,
  agent_address VARCHAR(50) NOT NULL,
  sub_agent_id INTEGER DEFAULT 0,
  collector_address VARCHAR(255) NOT NULL,
  collector_port INTEGER DEFAULT 6343,
  sampling_rate INTEGER DEFAULT 512,
  polling_interval_sec INTEGER DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_sflow_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_sflow_configs(id),
  interface_name VARCHAR(255) NOT NULL,
  if_speed BIGINT DEFAULT 0,
  if_in_octets BIGINT DEFAULT 0,
  if_out_octets BIGINT DEFAULT 0,
  if_in_errors BIGINT DEFAULT 0,
  if_out_errors BIGINT DEFAULT 0,
  if_in_discards BIGINT DEFAULT 0,
  sampled_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_sflow_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_sflow_configs(id),
  sample_type VARCHAR(50) DEFAULT 'flow',
  source_ip VARCHAR(50),
  dest_ip VARCHAR(50),
  protocol INTEGER,
  frame_length INTEGER,
  header_bytes BYTEA,
  sampled_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sflow_configs_agent ON agent_sflow_configs(agent_id);
CREATE INDEX idx_sflow_counters_config ON agent_sflow_counters(config_id);
CREATE INDEX idx_sflow_samples_config ON agent_sflow_samples(config_id);
