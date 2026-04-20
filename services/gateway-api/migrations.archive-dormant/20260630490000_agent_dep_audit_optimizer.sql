-- Migration: agent_dep_audit_optimizer
CREATE TABLE IF NOT EXISTS agent_dep_audit_optimizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_dep_audit_optimizer_agent ON agent_dep_audit_optimizer_configs(agent_id);
CREATE INDEX idx_agent_dep_audit_optimizer_enabled ON agent_dep_audit_optimizer_configs(enabled);
