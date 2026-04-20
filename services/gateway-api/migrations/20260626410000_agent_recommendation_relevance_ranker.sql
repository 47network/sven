-- Migration: agent_recommendation_relevance_ranker
CREATE TABLE IF NOT EXISTS agent_recommendation_relevance_ranker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_recommendation_relevance_ranker_agent ON agent_recommendation_relevance_ranker_configs(agent_id);
CREATE INDEX idx_agent_recommendation_relevance_ranker_enabled ON agent_recommendation_relevance_ranker_configs(enabled);
