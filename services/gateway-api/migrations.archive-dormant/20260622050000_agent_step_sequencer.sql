-- Migration: agent_step_sequencer
CREATE TABLE IF NOT EXISTS agent_step_sequencer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_step_sequencer_agent ON agent_step_sequencer_configs(agent_id);
CREATE INDEX idx_agent_step_sequencer_enabled ON agent_step_sequencer_configs(enabled);
