-- Migration: agent_key_mgmt_generator
CREATE TABLE IF NOT EXISTS agent_key_mgmt_generator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_key_mgmt_generator_agent ON agent_key_mgmt_generator_configs(agent_id);
CREATE INDEX idx_agent_key_mgmt_generator_enabled ON agent_key_mgmt_generator_configs(enabled);
