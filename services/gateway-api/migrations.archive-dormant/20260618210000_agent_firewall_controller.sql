-- Batch 184: Agent Firewall Controller
-- Manages firewall rules, security groups, access policies, and threat blocking

CREATE TABLE IF NOT EXISTS agent_firewall_rulesets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    ruleset_name TEXT NOT NULL,
    description TEXT,
    target_zone TEXT NOT NULL DEFAULT 'default',
    priority INTEGER NOT NULL DEFAULT 100,
    default_action TEXT NOT NULL DEFAULT 'deny' CHECK (default_action IN ('allow','deny','log')),
    rule_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','testing','archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_firewall_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruleset_id UUID NOT NULL REFERENCES agent_firewall_rulesets(id),
    rule_name TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound','both')),
    protocol TEXT NOT NULL DEFAULT 'tcp' CHECK (protocol IN ('tcp','udp','icmp','any')),
    source_cidr TEXT,
    destination_cidr TEXT,
    port_range TEXT,
    action TEXT NOT NULL DEFAULT 'allow' CHECK (action IN ('allow','deny','log','rate_limit')),
    priority INTEGER NOT NULL DEFAULT 100,
    hit_count BIGINT NOT NULL DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_firewall_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruleset_id UUID NOT NULL REFERENCES agent_firewall_rulesets(id),
    threat_type TEXT NOT NULL DEFAULT 'unknown' CHECK (threat_type IN ('brute_force','port_scan','ddos','intrusion','malware','unknown')),
    source_ip TEXT NOT NULL,
    target_ip TEXT,
    target_port INTEGER,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','info')),
    action_taken TEXT NOT NULL DEFAULT 'blocked' CHECK (action_taken IN ('blocked','allowed','rate_limited','logged','quarantined')),
    details JSONB DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_firewall_rulesets_agent ON agent_firewall_rulesets(agent_id);
CREATE INDEX idx_agent_firewall_rules_ruleset ON agent_firewall_rules(ruleset_id);
CREATE INDEX idx_agent_firewall_threats_ruleset ON agent_firewall_threats(ruleset_id);
CREATE INDEX idx_agent_firewall_threats_type ON agent_firewall_threats(threat_type);
CREATE INDEX idx_agent_firewall_threats_severity ON agent_firewall_threats(severity);
