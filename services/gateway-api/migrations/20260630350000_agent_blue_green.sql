-- Migration: agent_blue_green
CREATE TABLE IF NOT EXISTS agent_blue_green_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_blue_green_agent ON agent_blue_green_configs(agent_id);
CREATE INDEX idx_agent_blue_green_enabled ON agent_blue_green_configs(enabled);
