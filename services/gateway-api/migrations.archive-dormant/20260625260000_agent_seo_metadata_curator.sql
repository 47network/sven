-- Migration: agent_seo_metadata_curator
CREATE TABLE IF NOT EXISTS agent_seo_metadata_curator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_seo_metadata_curator_agent ON agent_seo_metadata_curator_configs(agent_id);
CREATE INDEX idx_agent_seo_metadata_curator_enabled ON agent_seo_metadata_curator_configs(enabled);
