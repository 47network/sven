-- Migration: agent_push_token_registry
CREATE TABLE IF NOT EXISTS agent_push_token_registry_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_push_token_registry_agent ON agent_push_token_registry_configs(agent_id);
CREATE INDEX idx_agent_push_token_registry_enabled ON agent_push_token_registry_configs(enabled);
