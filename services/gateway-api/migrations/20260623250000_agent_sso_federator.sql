-- Migration: agent_sso_federator
CREATE TABLE IF NOT EXISTS agent_sso_federator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_sso_federator_agent ON agent_sso_federator_configs(agent_id);
CREATE INDEX idx_agent_sso_federator_enabled ON agent_sso_federator_configs(enabled);
