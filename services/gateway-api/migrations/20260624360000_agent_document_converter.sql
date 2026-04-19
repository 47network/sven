-- Migration: agent_document_converter
CREATE TABLE IF NOT EXISTS agent_document_converter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_document_converter_agent ON agent_document_converter_configs(agent_id);
CREATE INDEX idx_agent_document_converter_enabled ON agent_document_converter_configs(enabled);
