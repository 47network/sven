-- Migration: agent_table_partitioner
CREATE TABLE IF NOT EXISTS agent_table_partitioner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_table_partitioner_agent ON agent_table_partitioner_configs(agent_id);
CREATE INDEX idx_agent_table_partitioner_enabled ON agent_table_partitioner_configs(enabled);
