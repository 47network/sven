-- Migration: agent_branch_protector
CREATE TABLE IF NOT EXISTS agent_branch_protector_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_branch_protector_agent ON agent_branch_protector_configs(agent_id);
CREATE INDEX idx_agent_branch_protector_enabled ON agent_branch_protector_configs(enabled);
