-- Migration: agent_oauth_token_service
CREATE TABLE IF NOT EXISTS agent_oauth_token_service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_oauth_token_service_agent ON agent_oauth_token_service_configs(agent_id);
CREATE INDEX idx_agent_oauth_token_service_enabled ON agent_oauth_token_service_configs(enabled);
