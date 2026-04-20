-- Migration: agent_vectordb_similarity_searcher
CREATE TABLE IF NOT EXISTS agent_vectordb_similarity_searcher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_vectordb_similarity_searcher_agent ON agent_vectordb_similarity_searcher_configs(agent_id);
CREATE INDEX idx_agent_vectordb_similarity_searcher_enabled ON agent_vectordb_similarity_searcher_configs(enabled);
