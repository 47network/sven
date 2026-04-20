-- Batch 276: Firewall Policy Manager
CREATE TABLE IF NOT EXISTS agent_fw_policy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  policy_name VARCHAR(255) NOT NULL,
  firewall_type VARCHAR(50) DEFAULT 'iptables',
  target_host VARCHAR(255) NOT NULL,
  zone_model VARCHAR(50) DEFAULT 'three_zone',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_fw_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_fw_policy_configs(id),
  chain VARCHAR(50) NOT NULL,
  rule_number INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  protocol VARCHAR(20),
  src_addr CIDR,
  dst_addr CIDR,
  dst_port VARCHAR(50),
  state_match VARCHAR(50),
  log_enabled BOOLEAN DEFAULT false,
  comment TEXT,
  hit_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_fw_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_fw_policy_configs(id),
  change_type VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  approved_by VARCHAR(100),
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fw_rules_config ON agent_fw_rules(config_id);
CREATE INDEX idx_fw_change_log_config ON agent_fw_change_log(config_id);
