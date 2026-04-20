-- Batch 88: Agent Search & Indexing
-- Full-text search indexes, query routing, and relevance tuning

CREATE TABLE IF NOT EXISTS search_indexes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  index_type TEXT NOT NULL CHECK (index_type IN ('full_text','vector','hybrid','autocomplete','faceted','geo')),
  source_table TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building','active','rebuilding','disabled','error')),
  document_count BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  last_indexed TIMESTAMPTZ,
  schema_config JSONB NOT NULL DEFAULT '{}',
  analyzer TEXT DEFAULT 'standard',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES search_indexes(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_type TEXT NOT NULL DEFAULT 'match' CHECK (query_type IN ('match','phrase','fuzzy','prefix','wildcard','semantic','boolean')),
  filters JSONB DEFAULT '{}',
  result_count INTEGER NOT NULL DEFAULT 0,
  took_ms NUMERIC(10,2) NOT NULL DEFAULT 0,
  user_id TEXT,
  clicked_results TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_synonyms (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES search_indexes(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  synonyms TEXT[] NOT NULL DEFAULT '{}',
  is_bidirectional BOOLEAN NOT NULL DEFAULT true,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_relevance_rules (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES search_indexes(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('boost','bury','pin','block','function_score','decay')),
  condition JSONB NOT NULL DEFAULT '{}',
  boost_value NUMERIC(5,2) DEFAULT 1.0,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_analytics (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES search_indexes(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_queries BIGINT NOT NULL DEFAULT 0,
  zero_result_queries BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  avg_result_count NUMERIC(10,2),
  click_through_rate NUMERIC(5,2),
  top_queries JSONB DEFAULT '[]',
  top_zero_result_queries JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_si_name ON search_indexes(name);
CREATE INDEX idx_si_type ON search_indexes(index_type);
CREATE INDEX idx_si_status ON search_indexes(status);
CREATE INDEX idx_si_source ON search_indexes(source_table);
CREATE INDEX idx_sq_index ON search_queries(index_id);
CREATE INDEX idx_sq_type ON search_queries(query_type);
CREATE INDEX idx_sq_created ON search_queries(created_at DESC);
CREATE INDEX idx_sq_user ON search_queries(user_id);
CREATE INDEX idx_sq_text ON search_queries USING GIN(to_tsvector('english', query_text));
CREATE INDEX idx_ss_index ON search_synonyms(index_id);
CREATE INDEX idx_ss_term ON search_synonyms(term);
CREATE INDEX idx_ss_language ON search_synonyms(language);
CREATE INDEX idx_srr_index ON search_relevance_rules(index_id);
CREATE INDEX idx_srr_type ON search_relevance_rules(rule_type);
CREATE INDEX idx_srr_active ON search_relevance_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_srr_priority ON search_relevance_rules(index_id, priority DESC);
CREATE INDEX idx_sa_index ON search_analytics(index_id);
CREATE INDEX idx_sa_period ON search_analytics(period_start, period_end);
CREATE INDEX idx_sa_created ON search_analytics(created_at DESC);
CREATE INDEX idx_sa_ctr ON search_analytics(click_through_rate DESC);
