-- Batch 329: Intrusion Guard - Network intrusion detection and prevention
CREATE TABLE IF NOT EXISTS agent_intrusion_guard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  detection_mode VARCHAR(20) NOT NULL DEFAULT 'ids',
  sensitivity VARCHAR(20) NOT NULL DEFAULT 'medium',
  auto_block BOOLEAN NOT NULL DEFAULT false,
  block_duration_minutes INTEGER NOT NULL DEFAULT 60,
  whitelist JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_intrusion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_intrusion_guard_configs(id),
  event_type VARCHAR(100) NOT NULL,
  source_ip VARCHAR(45),
  destination_ip VARCHAR(45),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  signature_id VARCHAR(50),
  description TEXT,
  blocked BOOLEAN NOT NULL DEFAULT false,
  raw_payload JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_intrusion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_intrusion_guard_configs(id),
  rule_name VARCHAR(255) NOT NULL,
  pattern TEXT NOT NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'alert',
  protocol VARCHAR(20) NOT NULL DEFAULT 'any',
  enabled BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_intrusion_guard_configs_agent ON agent_intrusion_guard_configs(agent_id);
CREATE INDEX idx_intrusion_events_config ON agent_intrusion_events(config_id);
CREATE INDEX idx_intrusion_rules_config ON agent_intrusion_rules(config_id);
