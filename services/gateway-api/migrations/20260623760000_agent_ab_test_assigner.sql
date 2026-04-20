-- Migration: agent_ab_test_assigner
CREATE TABLE IF NOT EXISTS agent_ab_test_assigner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_ab_test_assigner_agent ON agent_ab_test_assigner_configs(agent_id);
CREATE INDEX idx_agent_ab_test_assigner_enabled ON agent_ab_test_assigner_configs(enabled);
