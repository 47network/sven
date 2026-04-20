-- Migration: agent_response_compressor
CREATE TABLE IF NOT EXISTS agent_response_compressor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_response_compressor_agent ON agent_response_compressor_configs(agent_id);
CREATE INDEX idx_agent_response_compressor_enabled ON agent_response_compressor_configs(enabled);
