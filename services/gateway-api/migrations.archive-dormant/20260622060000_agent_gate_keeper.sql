-- Migration: agent_gate_keeper
CREATE TABLE IF NOT EXISTS agent_gate_keeper_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_gate_keeper_agent ON agent_gate_keeper_configs(agent_id);
CREATE INDEX idx_agent_gate_keeper_enabled ON agent_gate_keeper_configs(enabled);
