-- Migration: agent_rollout_strategist
CREATE TABLE IF NOT EXISTS agent_rollout_strategist_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_rollout_strategist_agent ON agent_rollout_strategist_configs(agent_id);
CREATE INDEX idx_agent_rollout_strategist_enabled ON agent_rollout_strategist_configs(enabled);
