-- Migration: agent_penetration_tester
CREATE TABLE IF NOT EXISTS agent_penetration_tester_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_penetration_tester_agent ON agent_penetration_tester_configs(agent_id);
CREATE INDEX idx_agent_penetration_tester_enabled ON agent_penetration_tester_configs(enabled);
