-- Batch 237: Network Firewall
-- Manages network-level security rules and traffic filtering

CREATE TABLE IF NOT EXISTS agent_firewall_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('inbound', 'outbound', 'both')),
  protocol VARCHAR(16) NOT NULL DEFAULT 'tcp' CHECK (protocol IN ('tcp', 'udp', 'icmp', 'any')),
  source_cidr VARCHAR(64),
  destination_cidr VARCHAR(64),
  port_range VARCHAR(32),
  action VARCHAR(16) NOT NULL CHECK (action IN ('allow', 'deny', 'log')),
  priority INTEGER NOT NULL DEFAULT 1000,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_firewall_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES agent_firewall_rules(id),
  agent_id UUID NOT NULL,
  source_ip VARCHAR(64) NOT NULL,
  destination_ip VARCHAR(64) NOT NULL,
  port INTEGER,
  protocol VARCHAR(16),
  action_taken VARCHAR(16) NOT NULL,
  packet_size INTEGER,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_firewall_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  zone_name VARCHAR(128) NOT NULL,
  zone_type VARCHAR(32) NOT NULL CHECK (zone_type IN ('trusted', 'untrusted', 'dmz', 'internal', 'restricted')),
  cidrs JSONB NOT NULL DEFAULT '[]',
  rules JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'testing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_firewall_rules_agent ON agent_firewall_rules(agent_id);
CREATE INDEX idx_firewall_rules_priority ON agent_firewall_rules(priority);
CREATE INDEX idx_firewall_logs_rule ON agent_firewall_logs(rule_id);
CREATE INDEX idx_firewall_logs_agent ON agent_firewall_logs(agent_id);
CREATE INDEX idx_firewall_zones_agent ON agent_firewall_zones(agent_id);
