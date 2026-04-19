-- Migration: agent_edge_rule_compiler
CREATE TABLE IF NOT EXISTS agent_edge_rule_compiler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_edge_rule_compiler_agent ON agent_edge_rule_compiler_configs(agent_id);
CREATE INDEX idx_agent_edge_rule_compiler_enabled ON agent_edge_rule_compiler_configs(enabled);
