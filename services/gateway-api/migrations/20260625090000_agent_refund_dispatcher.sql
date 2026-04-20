-- Migration: agent_refund_dispatcher
CREATE TABLE IF NOT EXISTS agent_refund_dispatcher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_refund_dispatcher_agent ON agent_refund_dispatcher_configs(agent_id);
CREATE INDEX idx_agent_refund_dispatcher_enabled ON agent_refund_dispatcher_configs(enabled);
