-- Migration: agent_egress_gateway
CREATE TABLE IF NOT EXISTS agent_egress_gateway_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_egress_gateway_agent ON agent_egress_gateway_configs(agent_id);
CREATE INDEX idx_agent_egress_gateway_enabled ON agent_egress_gateway_configs(enabled);
