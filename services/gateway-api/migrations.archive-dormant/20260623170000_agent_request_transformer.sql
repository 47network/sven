-- Migration: agent_request_transformer
CREATE TABLE IF NOT EXISTS agent_request_transformer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_request_transformer_agent ON agent_request_transformer_configs(agent_id);
CREATE INDEX idx_agent_request_transformer_enabled ON agent_request_transformer_configs(enabled);
