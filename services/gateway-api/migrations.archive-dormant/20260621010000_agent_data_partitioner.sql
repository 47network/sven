CREATE TABLE IF NOT EXISTS agent_data_partitioner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  partition_strategy TEXT NOT NULL DEFAULT 'range',
  partition_key TEXT NOT NULL DEFAULT 'created_at',
  partition_count INTEGER NOT NULL DEFAULT 12,
  retention_policy JSONB NOT NULL DEFAULT '{}',
  rebalance_schedule TEXT NOT NULL DEFAULT '0 3 * * 0',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_data_partitioner_configs_agent ON agent_data_partitioner_configs(agent_id);
CREATE INDEX idx_agent_data_partitioner_configs_enabled ON agent_data_partitioner_configs(enabled);
