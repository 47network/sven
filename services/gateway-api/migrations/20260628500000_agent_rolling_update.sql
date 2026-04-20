-- Migration: agent_rolling_update
CREATE TABLE IF NOT EXISTS agent_rolling_update_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_rolling_update_agent ON agent_rolling_update_configs(agent_id);
CREATE INDEX idx_agent_rolling_update_enabled ON agent_rolling_update_configs(enabled);
