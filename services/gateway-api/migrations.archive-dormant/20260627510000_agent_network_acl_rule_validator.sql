-- Migration: agent_network_acl_rule_validator
CREATE TABLE IF NOT EXISTS agent_network_acl_rule_validator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_network_acl_rule_validator_agent ON agent_network_acl_rule_validator_configs(agent_id);
CREATE INDEX idx_agent_network_acl_rule_validator_enabled ON agent_network_acl_rule_validator_configs(enabled);
