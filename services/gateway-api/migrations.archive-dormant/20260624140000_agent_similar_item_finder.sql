-- Migration: agent_similar_item_finder
CREATE TABLE IF NOT EXISTS agent_similar_item_finder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_similar_item_finder_agent ON agent_similar_item_finder_configs(agent_id);
CREATE INDEX idx_agent_similar_item_finder_enabled ON agent_similar_item_finder_configs(enabled);
