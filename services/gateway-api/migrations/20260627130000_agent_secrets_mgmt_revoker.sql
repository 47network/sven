-- Migration: agent_secrets_mgmt_revoker
CREATE TABLE IF NOT EXISTS agent_secrets_mgmt_revoker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_secrets_mgmt_revoker_agent ON agent_secrets_mgmt_revoker_configs(agent_id);
CREATE INDEX idx_agent_secrets_mgmt_revoker_enabled ON agent_secrets_mgmt_revoker_configs(enabled);
