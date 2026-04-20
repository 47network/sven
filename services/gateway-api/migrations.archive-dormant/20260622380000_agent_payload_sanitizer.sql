-- Migration: agent_payload_sanitizer
CREATE TABLE IF NOT EXISTS agent_payload_sanitizer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_payload_sanitizer_agent ON agent_payload_sanitizer_configs(agent_id);
CREATE INDEX idx_agent_payload_sanitizer_enabled ON agent_payload_sanitizer_configs(enabled);
