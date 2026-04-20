-- Migration: agent_ledger_manager
CREATE TABLE IF NOT EXISTS agent_ledger_manager_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_ledger_manager_agent ON agent_ledger_manager_configs(agent_id);
CREATE INDEX idx_agent_ledger_manager_enabled ON agent_ledger_manager_configs(enabled);
