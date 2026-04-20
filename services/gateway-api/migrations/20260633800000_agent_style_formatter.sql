-- Migration: agent_style_formatter
CREATE TABLE IF NOT EXISTS agent_style_formatter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_style_formatter_agent ON agent_style_formatter_configs(agent_id);
CREATE INDEX idx_agent_style_formatter_enabled ON agent_style_formatter_configs(enabled);
