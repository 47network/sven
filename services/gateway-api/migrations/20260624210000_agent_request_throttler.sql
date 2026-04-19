-- Migration: agent_request_throttler
CREATE TABLE IF NOT EXISTS agent_request_throttler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_request_throttler_agent ON agent_request_throttler_configs(agent_id);
CREATE INDEX idx_agent_request_throttler_enabled ON agent_request_throttler_configs(enabled);
