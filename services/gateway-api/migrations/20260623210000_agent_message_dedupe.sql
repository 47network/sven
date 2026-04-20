-- Migration: agent_message_dedupe
CREATE TABLE IF NOT EXISTS agent_message_dedupe_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_message_dedupe_agent ON agent_message_dedupe_configs(agent_id);
CREATE INDEX idx_agent_message_dedupe_enabled ON agent_message_dedupe_configs(enabled);
