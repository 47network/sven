-- Migration: agent_load_balancer_rate_limiter
CREATE TABLE IF NOT EXISTS agent_load_balancer_rate_limiter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_load_balancer_rate_limiter_agent ON agent_load_balancer_rate_limiter_configs(agent_id);
CREATE INDEX idx_agent_load_balancer_rate_limiter_enabled ON agent_load_balancer_rate_limiter_configs(enabled);
