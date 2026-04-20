-- Migration: agent_search_ranking_calibrator
CREATE TABLE IF NOT EXISTS agent_search_ranking_calibrator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_search_ranking_calibrator_agent ON agent_search_ranking_calibrator_configs(agent_id);
CREATE INDEX idx_agent_search_ranking_calibrator_enabled ON agent_search_ranking_calibrator_configs(enabled);
