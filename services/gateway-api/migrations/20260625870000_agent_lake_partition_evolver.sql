-- Migration: agent_lake_partition_evolver
CREATE TABLE IF NOT EXISTS agent_lake_partition_evolver_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_lake_partition_evolver_agent ON agent_lake_partition_evolver_configs(agent_id);
CREATE INDEX idx_agent_lake_partition_evolver_enabled ON agent_lake_partition_evolver_configs(enabled);
