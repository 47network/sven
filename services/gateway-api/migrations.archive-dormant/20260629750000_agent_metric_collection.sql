-- Migration: agent_metric_collection
CREATE TABLE IF NOT EXISTS agent_metric_collection_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_metric_collection_agent ON agent_metric_collection_configs(agent_id);
CREATE INDEX idx_agent_metric_collection_enabled ON agent_metric_collection_configs(enabled);
