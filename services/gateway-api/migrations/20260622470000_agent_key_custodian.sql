-- Migration: agent_key_custodian
CREATE TABLE IF NOT EXISTS agent_key_custodian_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_key_custodian_agent ON agent_key_custodian_configs(agent_id);
CREATE INDEX idx_agent_key_custodian_enabled ON agent_key_custodian_configs(enabled);
