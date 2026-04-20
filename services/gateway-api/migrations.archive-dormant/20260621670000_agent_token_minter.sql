-- Migration: agent_token_minter
CREATE TABLE IF NOT EXISTS agent_token_minter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_token_minter_agent ON agent_token_minter_configs(agent_id);
CREATE INDEX idx_agent_token_minter_enabled ON agent_token_minter_configs(enabled);
