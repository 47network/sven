-- Migration: agent_parallel_joiner
CREATE TABLE IF NOT EXISTS agent_parallel_joiner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_parallel_joiner_agent ON agent_parallel_joiner_configs(agent_id);
CREATE INDEX idx_agent_parallel_joiner_enabled ON agent_parallel_joiner_configs(enabled);
