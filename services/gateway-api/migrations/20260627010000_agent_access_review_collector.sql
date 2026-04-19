-- Migration: agent_access_review_collector
CREATE TABLE IF NOT EXISTS agent_access_review_collector_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_access_review_collector_agent ON agent_access_review_collector_configs(agent_id);
CREATE INDEX idx_agent_access_review_collector_enabled ON agent_access_review_collector_configs(enabled);
