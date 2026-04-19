-- Batch 262: VLAN Manager
CREATE TABLE IF NOT EXISTS agent_vlan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  vlan_id INTEGER NOT NULL,
  vlan_name VARCHAR(255) NOT NULL,
  subnet_cidr VARCHAR(50),
  gateway_ip VARCHAR(50),
  dhcp_enabled BOOLEAN DEFAULT false,
  mtu INTEGER DEFAULT 1500,
  tagged BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_vlan_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vlan_config_id UUID NOT NULL REFERENCES agent_vlan_configs(id),
  port_name VARCHAR(255) NOT NULL,
  port_type VARCHAR(50) DEFAULT 'access',
  native_vlan BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  mac_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_vlan_acls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vlan_config_id UUID NOT NULL REFERENCES agent_vlan_configs(id),
  acl_name VARCHAR(255) NOT NULL,
  direction VARCHAR(50) DEFAULT 'inbound',
  action VARCHAR(50) DEFAULT 'permit',
  source_cidr VARCHAR(50),
  dest_cidr VARCHAR(50),
  protocol VARCHAR(50),
  port_range VARCHAR(50),
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vlan_configs_agent ON agent_vlan_configs(agent_id);
CREATE INDEX idx_vlan_ports_config ON agent_vlan_ports(vlan_config_id);
CREATE INDEX idx_vlan_acls_config ON agent_vlan_acls(vlan_config_id);
