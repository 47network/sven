-- Migration: agent_currency_converter_reporter
CREATE TABLE IF NOT EXISTS agent_currency_converter_reporter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_currency_converter_reporter_agent ON agent_currency_converter_reporter_configs(agent_id);
CREATE INDEX idx_agent_currency_converter_reporter_enabled ON agent_currency_converter_reporter_configs(enabled);
