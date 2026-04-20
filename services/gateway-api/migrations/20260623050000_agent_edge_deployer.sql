-- Migration: agent_edge_deployer
CREATE TABLE IF NOT EXISTS agent_edge_deployer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_edge_deployer_agent ON agent_edge_deployer_configs(agent_id);
CREATE INDEX idx_agent_edge_deployer_enabled ON agent_edge_deployer_configs(enabled);
