-- Migration: agent_helm_releaser
CREATE TABLE IF NOT EXISTS agent_helm_releaser_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_helm_releaser_agent ON agent_helm_releaser_configs(agent_id);
CREATE INDEX idx_agent_helm_releaser_enabled ON agent_helm_releaser_configs(enabled);
