CREATE TABLE IF NOT EXISTS agent_table_optimizer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  target_tables JSONB NOT NULL DEFAULT '[]',
  optimization_goals JSONB NOT NULL DEFAULT '[]',
  vacuum_schedule TEXT NOT NULL DEFAULT '0 4 * * *',
  analyze_schedule TEXT NOT NULL DEFAULT '0 5 * * *',
  bloat_threshold_percent NUMERIC NOT NULL DEFAULT 20,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_table_optimizer_configs_agent ON agent_table_optimizer_configs(agent_id);
CREATE INDEX idx_agent_table_optimizer_configs_enabled ON agent_table_optimizer_configs(enabled);
