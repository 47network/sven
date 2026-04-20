-- Migration: agent_seo_structured_data_emitter
CREATE TABLE IF NOT EXISTS agent_seo_structured_data_emitter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_seo_structured_data_emitter_agent ON agent_seo_structured_data_emitter_configs(agent_id);
CREATE INDEX idx_agent_seo_structured_data_emitter_enabled ON agent_seo_structured_data_emitter_configs(enabled);
