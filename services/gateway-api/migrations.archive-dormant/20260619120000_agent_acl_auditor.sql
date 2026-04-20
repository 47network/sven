-- Batch 275: ACL Auditor
CREATE TABLE IF NOT EXISTS agent_acl_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  auditor_name VARCHAR(255) NOT NULL,
  target_device VARCHAR(255) NOT NULL,
  acl_type VARCHAR(50) DEFAULT 'standard',
  scan_schedule VARCHAR(50) DEFAULT 'daily',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_acl_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_acl_configs(id),
  rule_number INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  protocol VARCHAR(20),
  src_network CIDR,
  dst_network CIDR,
  port_range VARCHAR(50),
  hit_count BIGINT DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  is_shadowed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_acl_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_acl_configs(id),
  finding_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  affected_rules INTEGER[],
  recommendation TEXT,
  resolved BOOLEAN DEFAULT false,
  found_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_acl_entries_config ON agent_acl_entries(config_id);
CREATE INDEX idx_acl_findings_config ON agent_acl_findings(config_id);
