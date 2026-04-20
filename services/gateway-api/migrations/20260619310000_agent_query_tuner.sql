-- Batch 294: Query Tuner
CREATE TABLE IF NOT EXISTS agent_query_tuner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  db_type TEXT NOT NULL DEFAULT 'postgresql',
  slow_query_threshold_ms INTEGER DEFAULT 1000,
  auto_suggest BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_query_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_query_tuner_configs(id),
  query_text TEXT NOT NULL,
  execution_plan JSONB DEFAULT '{}',
  duration_ms DOUBLE PRECISION,
  rows_examined BIGINT,
  suggestions JSONB DEFAULT '[]',
  optimized_query TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_query_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_query_tuner_configs(id),
  table_name TEXT NOT NULL,
  index_name TEXT NOT NULL,
  columns JSONB DEFAULT '[]',
  index_type TEXT NOT NULL DEFAULT 'btree',
  applied BOOLEAN DEFAULT false,
  impact_estimate DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_query_tuner_configs_agent ON agent_query_tuner_configs(agent_id);
CREATE INDEX idx_query_analyses_config ON agent_query_analyses(config_id);
CREATE INDEX idx_query_indexes_config ON agent_query_indexes(config_id);
