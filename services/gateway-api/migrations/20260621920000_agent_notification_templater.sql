-- Migration: agent_notification_templater
CREATE TABLE IF NOT EXISTS agent_notification_templater_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_notification_templater_agent ON agent_notification_templater_configs(agent_id);
CREATE INDEX idx_agent_notification_templater_enabled ON agent_notification_templater_configs(enabled);
