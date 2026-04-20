-- Migration: agent_schema_checker_auditor
CREATE TABLE IF NOT EXISTS agent_schema_checker_auditor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_schema_checker_auditor_agent ON agent_schema_checker_auditor_configs(agent_id);
CREATE INDEX idx_agent_schema_checker_auditor_enabled ON agent_schema_checker_auditor_configs(enabled);
