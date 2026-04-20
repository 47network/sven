-- Migration: agent_credential_rotation
CREATE TABLE IF NOT EXISTS agent_credential_rotation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_credential_rotation_agent ON agent_credential_rotation_configs(agent_id);
CREATE INDEX idx_agent_credential_rotation_enabled ON agent_credential_rotation_configs(enabled);
