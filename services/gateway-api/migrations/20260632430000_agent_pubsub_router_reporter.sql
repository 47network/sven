-- Migration: agent_pubsub_router_reporter
CREATE TABLE IF NOT EXISTS agent_pubsub_router_reporter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pubsub_router_reporter_agent ON agent_pubsub_router_reporter_configs(agent_id);
CREATE INDEX idx_agent_pubsub_router_reporter_enabled ON agent_pubsub_router_reporter_configs(enabled);
