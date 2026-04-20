-- Migration: agent_release_drafter
CREATE TABLE IF NOT EXISTS agent_release_drafter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_release_drafter_agent ON agent_release_drafter_configs(agent_id);
CREATE INDEX idx_agent_release_drafter_enabled ON agent_release_drafter_configs(enabled);
