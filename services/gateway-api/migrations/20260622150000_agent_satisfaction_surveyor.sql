-- Migration: agent_satisfaction_surveyor
CREATE TABLE IF NOT EXISTS agent_satisfaction_surveyor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_satisfaction_surveyor_agent ON agent_satisfaction_surveyor_configs(agent_id);
CREATE INDEX idx_agent_satisfaction_surveyor_enabled ON agent_satisfaction_surveyor_configs(enabled);
