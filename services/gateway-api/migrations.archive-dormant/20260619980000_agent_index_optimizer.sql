-- Batch 361: Index Optimizer
-- Analyzes and optimizes database indexes for agent workload performance

CREATE TABLE IF NOT EXISTS agent_index_optimizer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_database VARCHAR(32) NOT NULL DEFAULT 'postgresql',
  analysis_schedule VARCHAR(64) NOT NULL DEFAULT '0 2 * * 0',
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  max_index_size_mb INTEGER NOT NULL DEFAULT 500,
  min_improvement_percent NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  include_schemas TEXT[] NOT NULL DEFAULT '{public}',
  exclude_tables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_index_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_index_optimizer_configs(id),
  agent_id UUID NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  current_indexes JSONB NOT NULL DEFAULT '[]',
  recommended_indexes JSONB NOT NULL DEFAULT '[]',
  redundant_indexes JSONB NOT NULL DEFAULT '[]',
  estimated_improvement_percent NUMERIC(5,2),
  table_size_bytes BIGINT,
  total_queries_analyzed INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'analyzing',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_index_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES agent_index_analyses(id),
  operation_type VARCHAR(32) NOT NULL,
  index_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  index_definition TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  rollback_sql TEXT,
  impact_metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_index_optimizer_configs_agent ON agent_index_optimizer_configs(agent_id);
CREATE INDEX idx_index_analyses_config ON agent_index_analyses(config_id);
CREATE INDEX idx_index_analyses_agent ON agent_index_analyses(agent_id);
CREATE INDEX idx_index_operations_analysis ON agent_index_operations(analysis_id);
