-- Migration: agent_content_personalizer
CREATE TABLE IF NOT EXISTS agent_content_personalizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_content_personalizer_agent ON agent_content_personalizer_configs(agent_id);
CREATE INDEX idx_agent_content_personalizer_enabled ON agent_content_personalizer_configs(enabled);
