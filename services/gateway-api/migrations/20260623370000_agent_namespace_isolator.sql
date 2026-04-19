-- Migration: agent_namespace_isolator
CREATE TABLE IF NOT EXISTS agent_namespace_isolator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_namespace_isolator_agent ON agent_namespace_isolator_configs(agent_id);
CREATE INDEX idx_agent_namespace_isolator_enabled ON agent_namespace_isolator_configs(enabled);
