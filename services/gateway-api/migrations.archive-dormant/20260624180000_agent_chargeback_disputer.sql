-- Migration: agent_chargeback_disputer
CREATE TABLE IF NOT EXISTS agent_chargeback_disputer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_chargeback_disputer_agent ON agent_chargeback_disputer_configs(agent_id);
CREATE INDEX idx_agent_chargeback_disputer_enabled ON agent_chargeback_disputer_configs(enabled);
