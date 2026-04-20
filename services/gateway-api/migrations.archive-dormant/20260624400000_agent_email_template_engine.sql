-- Migration: agent_email_template_engine
CREATE TABLE IF NOT EXISTS agent_email_template_engine_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_email_template_engine_agent ON agent_email_template_engine_configs(agent_id);
CREATE INDEX idx_agent_email_template_engine_enabled ON agent_email_template_engine_configs(enabled);
