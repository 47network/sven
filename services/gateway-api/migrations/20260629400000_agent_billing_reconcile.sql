-- Migration: agent_billing_reconcile
CREATE TABLE IF NOT EXISTS agent_billing_reconcile_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_billing_reconcile_agent ON agent_billing_reconcile_configs(agent_id);
CREATE INDEX idx_agent_billing_reconcile_enabled ON agent_billing_reconcile_configs(enabled);
