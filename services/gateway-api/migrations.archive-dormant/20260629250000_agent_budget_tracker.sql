-- Migration: agent_budget_tracker
CREATE TABLE IF NOT EXISTS agent_budget_tracker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_budget_tracker_agent ON agent_budget_tracker_configs(agent_id);
CREATE INDEX idx_agent_budget_tracker_enabled ON agent_budget_tracker_configs(enabled);
