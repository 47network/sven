-- Migration: agent_artifact_promoter
CREATE TABLE IF NOT EXISTS agent_artifact_promoter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_artifact_promoter_agent ON agent_artifact_promoter_configs(agent_id);
CREATE INDEX idx_agent_artifact_promoter_enabled ON agent_artifact_promoter_configs(enabled);
