-- Migration: agent_version_tagger
CREATE TABLE IF NOT EXISTS agent_version_tagger_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_version_tagger_agent ON agent_version_tagger_configs(agent_id);
CREATE INDEX idx_agent_version_tagger_enabled ON agent_version_tagger_configs(enabled);
