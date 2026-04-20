-- Migration: agent_queue_conductor
CREATE TABLE IF NOT EXISTS agent_queue_conductor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_queue_conductor_agent ON agent_queue_conductor_configs(agent_id);
CREATE INDEX idx_agent_queue_conductor_enabled ON agent_queue_conductor_configs(enabled);
