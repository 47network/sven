-- Migration: agent_artifact_vault_optimizer
CREATE TABLE IF NOT EXISTS agent_artifact_vault_optimizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_artifact_vault_optimizer_agent ON agent_artifact_vault_optimizer_configs(agent_id);
CREATE INDEX idx_agent_artifact_vault_optimizer_enabled ON agent_artifact_vault_optimizer_configs(enabled);
