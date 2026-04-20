-- Batch 267: ARP Inspector
CREATE TABLE IF NOT EXISTS agent_arp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  inspector_name VARCHAR(255) NOT NULL,
  monitored_vlans VARCHAR(255) DEFAULT 'all',
  rate_limit_pps INTEGER DEFAULT 15,
  trust_mode VARCHAR(50) DEFAULT 'strict',
  log_denied BOOLEAN DEFAULT true,
  dhcp_snooping BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_arp_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_arp_configs(id),
  ip_address VARCHAR(50) NOT NULL,
  mac_address VARCHAR(50) NOT NULL,
  vlan_id INTEGER,
  interface_name VARCHAR(255),
  binding_type VARCHAR(50) DEFAULT 'dynamic',
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_arp_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_arp_configs(id),
  violation_type VARCHAR(50) NOT NULL,
  source_ip VARCHAR(50),
  source_mac VARCHAR(50),
  expected_mac VARCHAR(50),
  interface_name VARCHAR(255),
  action_taken VARCHAR(50) DEFAULT 'logged',
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_arp_configs_agent ON agent_arp_configs(agent_id);
CREATE INDEX idx_arp_bindings_config ON agent_arp_bindings(config_id);
CREATE INDEX idx_arp_violations_config ON agent_arp_violations(config_id);
