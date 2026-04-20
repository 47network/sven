-- Migration: agent_moderation_image_screener
CREATE TABLE IF NOT EXISTS agent_moderation_image_screener_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_moderation_image_screener_agent ON agent_moderation_image_screener_configs(agent_id);
CREATE INDEX idx_agent_moderation_image_screener_enabled ON agent_moderation_image_screener_configs(enabled);
