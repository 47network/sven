-- Migration: agent_collaborative_filter
CREATE TABLE IF NOT EXISTS agent_collaborative_filter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_collaborative_filter_agent ON agent_collaborative_filter_configs(agent_id);
CREATE INDEX idx_agent_collaborative_filter_enabled ON agent_collaborative_filter_configs(enabled);
