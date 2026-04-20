-- Batch 216: Firewall Manager
-- Agent-managed firewall rules and security policies

CREATE TABLE IF NOT EXISTS agent_firewall_rulesets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    ruleset_name VARCHAR(255) NOT NULL,
    ruleset_type VARCHAR(50) NOT NULL CHECK (ruleset_type IN ('ingress','egress','internal','dmz','application','network','host')),
    default_action VARCHAR(20) NOT NULL DEFAULT 'deny' CHECK (default_action IN ('allow','deny','log','reject')),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','testing','audit','disabled')),
    priority INTEGER NOT NULL DEFAULT 100,
    applied_to TEXT[] NOT NULL DEFAULT '{}',
    rule_count INTEGER NOT NULL DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ,
    evaluation_count BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_firewall_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruleset_id UUID NOT NULL REFERENCES agent_firewall_rulesets(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('allow','deny','log','reject','rate_limit','redirect','nat')),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound','both')),
    protocol VARCHAR(20) CHECK (protocol IN ('tcp','udp','icmp','any','sctp','gre','esp')),
    source_cidr TEXT,
    destination_cidr TEXT,
    source_port VARCHAR(50),
    destination_port VARCHAR(50),
    priority INTEGER NOT NULL DEFAULT 100,
    enabled BOOLEAN NOT NULL DEFAULT true,
    hit_count BIGINT NOT NULL DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_firewall_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES agent_firewall_rules(id) ON DELETE SET NULL,
    ruleset_id UUID NOT NULL REFERENCES agent_firewall_rulesets(id) ON DELETE CASCADE,
    action_taken VARCHAR(20) NOT NULL,
    source_ip INET,
    destination_ip INET,
    source_port INTEGER,
    destination_port INTEGER,
    protocol VARCHAR(20),
    packet_size INTEGER,
    threat_level VARCHAR(20) CHECK (threat_level IN ('none','low','medium','high','critical')),
    geo_source VARCHAR(10),
    metadata JSONB NOT NULL DEFAULT '{}',
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_firewall_rulesets_agent ON agent_firewall_rulesets(agent_id);
CREATE INDEX idx_firewall_rulesets_type ON agent_firewall_rulesets(ruleset_type);
CREATE INDEX idx_firewall_rules_ruleset ON agent_firewall_rules(ruleset_id);
CREATE INDEX idx_firewall_rules_action ON agent_firewall_rules(action);
CREATE INDEX idx_firewall_logs_ruleset ON agent_firewall_logs(ruleset_id);
CREATE INDEX idx_firewall_logs_action ON agent_firewall_logs(action_taken);
CREATE INDEX idx_firewall_logs_logged ON agent_firewall_logs(logged_at);
