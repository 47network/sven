-- Batch 207: Query Optimizer
-- SQL query analysis, optimization suggestions, execution plan caching

CREATE TABLE IF NOT EXISTS agent_query_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  original_query TEXT NOT NULL,
  normalized_query TEXT,
  query_hash VARCHAR(128),
  database_type VARCHAR(30) NOT NULL CHECK (database_type IN ('postgresql','mysql','sqlite','mongodb','opensearch','clickhouse','duckdb','bigquery')),
  execution_plan JSONB,
  estimated_cost NUMERIC(15,4),
  actual_duration_ms BIGINT,
  rows_examined BIGINT,
  rows_returned BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_query_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES agent_query_analyses(id),
  suggestion_type VARCHAR(50) NOT NULL CHECK (suggestion_type IN ('add_index','rewrite_query','partition_table','materialize_view','denormalize','cache_result','batch_query','parallel_query')),
  description TEXT NOT NULL,
  optimized_query TEXT,
  estimated_improvement_pct NUMERIC(5,2),
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_query_plan_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(128) NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id),
  execution_plan JSONB NOT NULL,
  hit_count BIGINT DEFAULT 1,
  avg_duration_ms NUMERIC(12,2),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(query_hash, agent_id)
);

CREATE INDEX idx_query_analyses_agent ON agent_query_analyses(agent_id);
CREATE INDEX idx_query_analyses_hash ON agent_query_analyses(query_hash);
CREATE INDEX idx_query_suggestions_analysis ON agent_query_suggestions(analysis_id);
CREATE INDEX idx_query_plan_cache_hash ON agent_query_plan_cache(query_hash);
CREATE INDEX idx_query_plan_cache_agent ON agent_query_plan_cache(agent_id);
