CREATE TABLE IF NOT EXISTS agent_log_indexer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  index_name TEXT NOT NULL,
  log_sources JSONB NOT NULL DEFAULT '[]',
  retention_days INTEGER NOT NULL DEFAULT 30,
  parsing_rules JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_log_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_indexer_configs(id),
  index_name TEXT NOT NULL,
  document_count BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_log_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_indexer_configs(id),
  query_text TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  result_count INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  saved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_log_indices_config ON agent_log_indices(config_id);
CREATE INDEX idx_agent_log_queries_config ON agent_log_queries(config_id);
