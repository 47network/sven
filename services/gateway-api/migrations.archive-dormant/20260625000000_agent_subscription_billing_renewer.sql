-- Migration: agent_subscription_billing_renewer
CREATE TABLE IF NOT EXISTS agent_subscription_billing_renewer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_subscription_billing_renewer_agent ON agent_subscription_billing_renewer_configs(agent_id);
CREATE INDEX idx_agent_subscription_billing_renewer_enabled ON agent_subscription_billing_renewer_configs(enabled);
