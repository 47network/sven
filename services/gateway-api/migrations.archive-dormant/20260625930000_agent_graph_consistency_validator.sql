-- Migration: agent_graph_consistency_validator
CREATE TABLE IF NOT EXISTS agent_graph_consistency_validator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_graph_consistency_validator_agent ON agent_graph_consistency_validator_configs(agent_id);
CREATE INDEX idx_agent_graph_consistency_validator_enabled ON agent_graph_consistency_validator_configs(enabled);
