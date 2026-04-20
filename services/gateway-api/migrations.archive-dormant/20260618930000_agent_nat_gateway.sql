-- Batch 256: NAT Gateway — network address translation management
CREATE TABLE IF NOT EXISTS agent_nat_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  gateway_name VARCHAR(255) NOT NULL,
  nat_type VARCHAR(50) NOT NULL DEFAULT 'snat',
  external_ip INET,
  internal_cidr VARCHAR(50),
  masquerade BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_nat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_nat_configs(id),
  rule_type VARCHAR(50) NOT NULL DEFAULT 'snat',
  source_cidr VARCHAR(50),
  destination_cidr VARCHAR(50),
  translated_ip INET,
  translated_port INTEGER,
  protocol VARCHAR(20) DEFAULT 'tcp',
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_nat_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_nat_configs(id),
  original_ip INET NOT NULL,
  translated_ip INET NOT NULL,
  original_port INTEGER,
  translated_port INTEGER,
  protocol VARCHAR(20),
  packets_count BIGINT NOT NULL DEFAULT 0,
  bytes_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nat_configs_agent ON agent_nat_configs(agent_id);
CREATE INDEX idx_nat_rules_config ON agent_nat_rules(config_id);
CREATE INDEX idx_nat_translations_config ON agent_nat_translations(config_id);
