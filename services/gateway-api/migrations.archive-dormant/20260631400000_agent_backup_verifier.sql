-- Migration: agent_backup_verifier
CREATE TABLE IF NOT EXISTS agent_backup_verifier_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_backup_verifier_agent ON agent_backup_verifier_configs(agent_id);
CREATE INDEX idx_agent_backup_verifier_enabled ON agent_backup_verifier_configs(enabled);
