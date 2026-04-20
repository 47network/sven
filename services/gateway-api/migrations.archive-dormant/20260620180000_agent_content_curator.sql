CREATE TABLE IF NOT EXISTS agent_content_curator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  curation_strategy TEXT NOT NULL DEFAULT 'quality_first',
  freshness_weight NUMERIC(4,3) NOT NULL DEFAULT 0.300,
  relevance_weight NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  diversity_weight NUMERIC(4,3) NOT NULL DEFAULT 0.200,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_curated_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_content_curator_configs(id),
  agent_id UUID NOT NULL,
  collection_name TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_curated_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES agent_curated_collections(id),
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  relevance_score NUMERIC(5,3) NOT NULL DEFAULT 0,
  quality_score NUMERIC(5,3) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curated_collections_agent ON agent_curated_collections(agent_id);
CREATE INDEX IF NOT EXISTS idx_curated_items_collection ON agent_curated_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_curated_items_relevance ON agent_curated_items(relevance_score DESC);
