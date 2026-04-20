-- Migration: agent_docstore_writer
CREATE TABLE IF NOT EXISTS agent_docstore_writer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_docstore_writer_agent ON agent_docstore_writer_configs(agent_id);
CREATE INDEX idx_agent_docstore_writer_enabled ON agent_docstore_writer_configs(enabled);
