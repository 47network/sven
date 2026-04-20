-- Migration: agent_quality_scorer
CREATE TABLE IF NOT EXISTS agent_quality_scorer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_quality_scorer_agent ON agent_quality_scorer_configs(agent_id);
CREATE INDEX idx_agent_quality_scorer_enabled ON agent_quality_scorer_configs(enabled);
