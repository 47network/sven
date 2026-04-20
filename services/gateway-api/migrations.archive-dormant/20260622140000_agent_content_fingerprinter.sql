-- Migration: agent_content_fingerprinter
CREATE TABLE IF NOT EXISTS agent_content_fingerprinter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_content_fingerprinter_agent ON agent_content_fingerprinter_configs(agent_id);
CREATE INDEX idx_agent_content_fingerprinter_enabled ON agent_content_fingerprinter_configs(enabled);
