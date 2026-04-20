-- Migration: agent_vector_embedding_indexer
CREATE TABLE IF NOT EXISTS agent_vector_embedding_indexer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_vector_embedding_indexer_agent ON agent_vector_embedding_indexer_configs(agent_id);
CREATE INDEX idx_agent_vector_embedding_indexer_enabled ON agent_vector_embedding_indexer_configs(enabled);
