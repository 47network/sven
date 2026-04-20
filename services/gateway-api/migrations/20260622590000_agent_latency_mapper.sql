-- Migration: agent_latency_mapper
CREATE TABLE IF NOT EXISTS agent_latency_mapper_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_latency_mapper_agent ON agent_latency_mapper_configs(agent_id);
CREATE INDEX idx_agent_latency_mapper_enabled ON agent_latency_mapper_configs(enabled);
