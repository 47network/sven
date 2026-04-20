-- Migration: agent_document_versioning_engine
CREATE TABLE IF NOT EXISTS agent_document_versioning_engine_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_document_versioning_engine_agent ON agent_document_versioning_engine_configs(agent_id);
CREATE INDEX idx_agent_document_versioning_engine_enabled ON agent_document_versioning_engine_configs(enabled);
