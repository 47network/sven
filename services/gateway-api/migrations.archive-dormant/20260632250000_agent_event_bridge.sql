-- Migration: agent_event_bridge
CREATE TABLE IF NOT EXISTS agent_event_bridge_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_event_bridge_agent ON agent_event_bridge_configs(agent_id);
CREATE INDEX idx_agent_event_bridge_enabled ON agent_event_bridge_configs(enabled);
