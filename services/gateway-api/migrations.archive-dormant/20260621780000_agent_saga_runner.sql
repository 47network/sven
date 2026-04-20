-- Migration: agent_saga_runner
CREATE TABLE IF NOT EXISTS agent_saga_runner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_saga_runner_agent ON agent_saga_runner_configs(agent_id);
CREATE INDEX idx_agent_saga_runner_enabled ON agent_saga_runner_configs(enabled);
