-- Migration: agent_geo_fencer
CREATE TABLE IF NOT EXISTS agent_geo_fencer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_geo_fencer_agent ON agent_geo_fencer_configs(agent_id);
CREATE INDEX idx_agent_geo_fencer_enabled ON agent_geo_fencer_configs(enabled);
