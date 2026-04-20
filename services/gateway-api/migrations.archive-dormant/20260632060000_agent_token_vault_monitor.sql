-- Migration: agent_token_vault_monitor
CREATE TABLE IF NOT EXISTS agent_token_vault_monitor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_token_vault_monitor_agent ON agent_token_vault_monitor_configs(agent_id);
CREATE INDEX idx_agent_token_vault_monitor_enabled ON agent_token_vault_monitor_configs(enabled);
