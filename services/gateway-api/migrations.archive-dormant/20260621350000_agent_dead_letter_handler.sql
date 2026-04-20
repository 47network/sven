-- Migration: agent_dead_letter_handler
CREATE TABLE IF NOT EXISTS agent_dead_letter_handler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_dead_letter_handler_agent ON agent_dead_letter_handler_configs(agent_id);
CREATE INDEX idx_agent_dead_letter_handler_enabled ON agent_dead_letter_handler_configs(enabled);
