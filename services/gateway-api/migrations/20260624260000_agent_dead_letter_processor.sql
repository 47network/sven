-- Migration: agent_dead_letter_processor
CREATE TABLE IF NOT EXISTS agent_dead_letter_processor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_dead_letter_processor_agent ON agent_dead_letter_processor_configs(agent_id);
CREATE INDEX idx_agent_dead_letter_processor_enabled ON agent_dead_letter_processor_configs(enabled);
