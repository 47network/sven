-- Migration: agent_release_gater
CREATE TABLE IF NOT EXISTS agent_release_gater_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_release_gater_agent ON agent_release_gater_configs(agent_id);
CREATE INDEX idx_agent_release_gater_enabled ON agent_release_gater_configs(enabled);
