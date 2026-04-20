-- Migration: agent_latency_reducer
CREATE TABLE IF NOT EXISTS agent_latency_reducer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_latency_reducer_agent ON agent_latency_reducer_configs(agent_id);
CREATE INDEX idx_agent_latency_reducer_enabled ON agent_latency_reducer_configs(enabled);
