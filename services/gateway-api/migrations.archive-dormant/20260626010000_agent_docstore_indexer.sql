-- Migration: agent_docstore_indexer
CREATE TABLE IF NOT EXISTS agent_docstore_indexer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_docstore_indexer_agent ON agent_docstore_indexer_configs(agent_id);
CREATE INDEX idx_agent_docstore_indexer_enabled ON agent_docstore_indexer_configs(enabled);
