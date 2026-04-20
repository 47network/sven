-- Migration: agent_api_gateway_router
CREATE TABLE IF NOT EXISTS agent_api_gateway_router_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_api_gateway_router_agent ON agent_api_gateway_router_configs(agent_id);
CREATE INDEX idx_agent_api_gateway_router_enabled ON agent_api_gateway_router_configs(enabled);
