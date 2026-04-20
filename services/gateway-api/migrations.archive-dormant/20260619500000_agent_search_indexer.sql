-- Batch 313: Search Indexer vertical
CREATE TABLE IF NOT EXISTS agent_search_idx_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  engine TEXT NOT NULL DEFAULT 'opensearch' CHECK (engine IN ('opensearch','elasticsearch','meilisearch','typesense')),
  index_prefix TEXT NOT NULL DEFAULT 'sven',
  shard_count INTEGER NOT NULL DEFAULT 3,
  replica_count INTEGER NOT NULL DEFAULT 1,
  refresh_interval_ms INTEGER NOT NULL DEFAULT 1000,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_search_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_search_idx_configs(id),
  index_name TEXT NOT NULL,
  doc_count BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mapping JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'green' CHECK (status IN ('green','yellow','red')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL REFERENCES agent_search_indexes(id),
  query_text TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_search_idx_configs_agent ON agent_search_idx_configs(agent_id);
CREATE INDEX idx_search_indexes_config ON agent_search_indexes(config_id);
CREATE INDEX idx_search_queries_index ON agent_search_queries(index_id);
