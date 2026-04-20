-- Migration: agent_identity_provisioning_deactivator
CREATE TABLE IF NOT EXISTS agent_identity_provisioning_deactivator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_identity_provisioning_deactivator_agent ON agent_identity_provisioning_deactivator_configs(agent_id);
CREATE INDEX idx_agent_identity_provisioning_deactivator_enabled ON agent_identity_provisioning_deactivator_configs(enabled);
