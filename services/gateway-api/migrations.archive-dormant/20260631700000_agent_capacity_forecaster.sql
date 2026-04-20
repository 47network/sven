-- Migration: agent_capacity_forecaster
CREATE TABLE IF NOT EXISTS agent_capacity_forecaster_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_capacity_forecaster_agent ON agent_capacity_forecaster_configs(agent_id);
CREATE INDEX idx_agent_capacity_forecaster_enabled ON agent_capacity_forecaster_configs(enabled);
