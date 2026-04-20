-- Migration: agent_storage_provisioner
CREATE TABLE IF NOT EXISTS agent_storage_provisioner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_storage_provisioner_agent ON agent_storage_provisioner_configs(agent_id);
CREATE INDEX idx_agent_storage_provisioner_enabled ON agent_storage_provisioner_configs(enabled);
