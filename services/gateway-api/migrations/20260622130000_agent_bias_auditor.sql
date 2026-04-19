-- Migration: agent_bias_auditor
CREATE TABLE IF NOT EXISTS agent_bias_auditor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_bias_auditor_agent ON agent_bias_auditor_configs(agent_id);
CREATE INDEX idx_agent_bias_auditor_enabled ON agent_bias_auditor_configs(enabled);
