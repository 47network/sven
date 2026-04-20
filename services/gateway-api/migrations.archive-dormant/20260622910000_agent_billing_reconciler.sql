-- Migration: agent_billing_reconciler
CREATE TABLE IF NOT EXISTS agent_billing_reconciler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_billing_reconciler_agent ON agent_billing_reconciler_configs(agent_id);
CREATE INDEX idx_agent_billing_reconciler_enabled ON agent_billing_reconciler_configs(enabled);
