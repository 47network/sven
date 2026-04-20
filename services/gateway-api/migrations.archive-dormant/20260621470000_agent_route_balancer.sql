-- Migration: agent_route_balancer
CREATE TABLE IF NOT EXISTS agent_route_balancer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_route_balancer_agent ON agent_route_balancer_configs(agent_id);
CREATE INDEX idx_agent_route_balancer_enabled ON agent_route_balancer_configs(enabled);
