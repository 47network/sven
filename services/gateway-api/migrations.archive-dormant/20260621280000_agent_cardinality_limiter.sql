-- Migration: agent_cardinality_limiter
CREATE TABLE IF NOT EXISTS agent_cardinality_limiter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cardinality_limiter_agent ON agent_cardinality_limiter_configs(agent_id);
CREATE INDEX idx_agent_cardinality_limiter_enabled ON agent_cardinality_limiter_configs(enabled);
