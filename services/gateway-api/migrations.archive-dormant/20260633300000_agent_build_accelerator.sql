-- Migration: agent_build_accelerator
CREATE TABLE IF NOT EXISTS agent_build_accelerator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_build_accelerator_agent ON agent_build_accelerator_configs(agent_id);
CREATE INDEX idx_agent_build_accelerator_enabled ON agent_build_accelerator_configs(enabled);
