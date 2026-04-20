-- Migration: agent_personalization_content_selector
CREATE TABLE IF NOT EXISTS agent_personalization_content_selector_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_personalization_content_selector_agent ON agent_personalization_content_selector_configs(agent_id);
CREATE INDEX idx_agent_personalization_content_selector_enabled ON agent_personalization_content_selector_configs(enabled);
