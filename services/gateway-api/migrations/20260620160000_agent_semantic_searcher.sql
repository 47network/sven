CREATE TABLE IF NOT EXISTS agent_semantic_searcher_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  search_strategy TEXT NOT NULL DEFAULT 'hybrid',
  reranking_enabled BOOLEAN NOT NULL DEFAULT true,
  max_results INTEGER NOT NULL DEFAULT 10,
  similarity_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.750,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_semantic_searcher_configs(id),
  agent_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  query_embedding JSONB,
  results_count INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  search_type TEXT NOT NULL DEFAULT 'semantic',
  filters JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES agent_search_queries(id),
  chunk_id UUID,
  rank_position INTEGER NOT NULL,
  similarity_score NUMERIC(6,4) NOT NULL DEFAULT 0,
  rerank_score NUMERIC(6,4),
  snippet TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_queries_agent ON agent_search_queries(agent_id);
CREATE INDEX IF NOT EXISTS idx_search_results_query ON agent_search_results(query_id);
CREATE INDEX IF NOT EXISTS idx_search_results_score ON agent_search_results(similarity_score DESC);
