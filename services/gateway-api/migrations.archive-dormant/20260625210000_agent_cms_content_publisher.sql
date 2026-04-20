-- Migration: agent_cms_content_publisher
CREATE TABLE IF NOT EXISTS agent_cms_content_publisher_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_cms_content_publisher_agent ON agent_cms_content_publisher_configs(agent_id);
CREATE INDEX idx_agent_cms_content_publisher_enabled ON agent_cms_content_publisher_configs(enabled);
