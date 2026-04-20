-- Batch 263: Network Tap
CREATE TABLE IF NOT EXISTS agent_tap_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  tap_name VARCHAR(255) NOT NULL,
  capture_interface VARCHAR(255) NOT NULL,
  mirror_port VARCHAR(255),
  filter_expression VARCHAR(500),
  capture_mode VARCHAR(50) DEFAULT 'passive',
  buffer_size_mb INTEGER DEFAULT 256,
  snap_length INTEGER DEFAULT 65535,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_tap_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tap_id UUID NOT NULL REFERENCES agent_tap_configs(id),
  session_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  packets_captured BIGINT DEFAULT 0,
  bytes_captured BIGINT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  output_path VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_tap_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tap_id UUID NOT NULL REFERENCES agent_tap_configs(id),
  filter_name VARCHAR(255) NOT NULL,
  bpf_expression VARCHAR(500) NOT NULL,
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tap_configs_agent ON agent_tap_configs(agent_id);
CREATE INDEX idx_tap_sessions_tap ON agent_tap_sessions(tap_id);
CREATE INDEX idx_tap_filters_tap ON agent_tap_filters(tap_id);
