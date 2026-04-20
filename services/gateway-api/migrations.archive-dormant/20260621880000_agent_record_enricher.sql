-- Migration: agent_record_enricher
CREATE TABLE IF NOT EXISTS agent_record_enricher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_record_enricher_agent ON agent_record_enricher_configs(agent_id);
CREATE INDEX idx_agent_record_enricher_enabled ON agent_record_enricher_configs(enabled);
