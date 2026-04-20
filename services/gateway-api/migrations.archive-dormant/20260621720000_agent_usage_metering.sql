-- Migration: agent_usage_metering
CREATE TABLE IF NOT EXISTS agent_usage_metering_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_usage_metering_agent ON agent_usage_metering_configs(agent_id);
CREATE INDEX idx_agent_usage_metering_enabled ON agent_usage_metering_configs(enabled);
