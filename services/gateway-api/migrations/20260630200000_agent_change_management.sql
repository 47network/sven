-- Migration: agent_change_management
CREATE TABLE IF NOT EXISTS agent_change_management_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_change_management_agent ON agent_change_management_configs(agent_id);
CREATE INDEX idx_agent_change_management_enabled ON agent_change_management_configs(enabled);
