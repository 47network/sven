-- Migration: agent_refresh_token_rotator
CREATE TABLE IF NOT EXISTS agent_refresh_token_rotator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_refresh_token_rotator_agent ON agent_refresh_token_rotator_configs(agent_id);
CREATE INDEX idx_agent_refresh_token_rotator_enabled ON agent_refresh_token_rotator_configs(enabled);
