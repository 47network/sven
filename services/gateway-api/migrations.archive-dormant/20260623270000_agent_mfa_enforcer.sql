-- Migration: agent_mfa_enforcer
CREATE TABLE IF NOT EXISTS agent_mfa_enforcer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_mfa_enforcer_agent ON agent_mfa_enforcer_configs(agent_id);
CREATE INDEX idx_agent_mfa_enforcer_enabled ON agent_mfa_enforcer_configs(enabled);
