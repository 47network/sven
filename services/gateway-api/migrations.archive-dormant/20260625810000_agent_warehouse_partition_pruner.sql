-- Migration: agent_warehouse_partition_pruner
CREATE TABLE IF NOT EXISTS agent_warehouse_partition_pruner_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_warehouse_partition_pruner_agent ON agent_warehouse_partition_pruner_configs(agent_id);
CREATE INDEX idx_agent_warehouse_partition_pruner_enabled ON agent_warehouse_partition_pruner_configs(enabled);
