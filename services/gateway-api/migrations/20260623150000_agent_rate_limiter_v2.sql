-- Migration: agent_rate_limiter_v2
CREATE TABLE IF NOT EXISTS agent_rate_limiter_v2_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_rate_limiter_v2_agent ON agent_rate_limiter_v2_configs(agent_id);
CREATE INDEX idx_agent_rate_limiter_v2_enabled ON agent_rate_limiter_v2_configs(enabled);
