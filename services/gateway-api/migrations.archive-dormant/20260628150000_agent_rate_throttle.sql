-- Migration: agent_rate_throttle
CREATE TABLE IF NOT EXISTS agent_rate_throttle_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_rate_throttle_agent ON agent_rate_throttle_configs(agent_id);
CREATE INDEX idx_agent_rate_throttle_enabled ON agent_rate_throttle_configs(enabled);
