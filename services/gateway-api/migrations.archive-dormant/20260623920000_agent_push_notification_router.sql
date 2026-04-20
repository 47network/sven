-- Migration: agent_push_notification_router
CREATE TABLE IF NOT EXISTS agent_push_notification_router_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_push_notification_router_agent ON agent_push_notification_router_configs(agent_id);
CREATE INDEX idx_agent_push_notification_router_enabled ON agent_push_notification_router_configs(enabled);
