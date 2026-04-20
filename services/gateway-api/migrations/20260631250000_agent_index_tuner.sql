-- Migration: agent_index_tuner
CREATE TABLE IF NOT EXISTS agent_index_tuner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_index_tuner_agent ON agent_index_tuner_configs(agent_id);
CREATE INDEX idx_agent_index_tuner_enabled ON agent_index_tuner_configs(enabled);
