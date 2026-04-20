-- Migration: agent_log_aggregation
CREATE TABLE IF NOT EXISTS agent_log_aggregation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_log_aggregation_agent ON agent_log_aggregation_configs(agent_id);
CREATE INDEX idx_agent_log_aggregation_enabled ON agent_log_aggregation_configs(enabled);
