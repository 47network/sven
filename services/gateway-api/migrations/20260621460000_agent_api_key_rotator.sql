-- Migration: agent_api_key_rotator
CREATE TABLE IF NOT EXISTS agent_api_key_rotator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_api_key_rotator_agent ON agent_api_key_rotator_configs(agent_id);
CREATE INDEX idx_agent_api_key_rotator_enabled ON agent_api_key_rotator_configs(enabled);
