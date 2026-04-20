-- Migration: agent_lake_compactor
CREATE TABLE IF NOT EXISTS agent_lake_compactor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_lake_compactor_agent ON agent_lake_compactor_configs(agent_id);
CREATE INDEX idx_agent_lake_compactor_enabled ON agent_lake_compactor_configs(enabled);
