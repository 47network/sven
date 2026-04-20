-- Migration: agent_subscription_cancellation_handler
CREATE TABLE IF NOT EXISTS agent_subscription_cancellation_handler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_subscription_cancellation_handler_agent ON agent_subscription_cancellation_handler_configs(agent_id);
CREATE INDEX idx_agent_subscription_cancellation_handler_enabled ON agent_subscription_cancellation_handler_configs(enabled);
