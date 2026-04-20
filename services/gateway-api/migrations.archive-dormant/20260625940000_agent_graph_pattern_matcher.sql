-- Migration: agent_graph_pattern_matcher
CREATE TABLE IF NOT EXISTS agent_graph_pattern_matcher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_graph_pattern_matcher_agent ON agent_graph_pattern_matcher_configs(agent_id);
CREATE INDEX idx_agent_graph_pattern_matcher_enabled ON agent_graph_pattern_matcher_configs(enabled);
