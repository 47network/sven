-- Migration: agent_response_cacher
CREATE TABLE IF NOT EXISTS agent_response_cacher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_response_cacher_agent ON agent_response_cacher_configs(agent_id);
CREATE INDEX idx_agent_response_cacher_enabled ON agent_response_cacher_configs(enabled);
