-- Migration: agent_cost_analyzer
CREATE TABLE IF NOT EXISTS agent_cost_analyzer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cost_analyzer_agent ON agent_cost_analyzer_configs(agent_id);
CREATE INDEX idx_agent_cost_analyzer_enabled ON agent_cost_analyzer_configs(enabled);
