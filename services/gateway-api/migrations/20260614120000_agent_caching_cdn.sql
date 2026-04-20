-- Batch 72: Agent Caching & CDN
-- Cache policies, cache entries, CDN distribution, purge management, and cache analytics

CREATE TABLE IF NOT EXISTS cache_policies (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  name            TEXT NOT NULL,
  cache_type      TEXT NOT NULL DEFAULT 'memory' CHECK (cache_type IN ('memory','disk','distributed','cdn','edge')),
  ttl_seconds     INTEGER NOT NULL DEFAULT 3600,
  max_size_bytes  BIGINT DEFAULT 0,
  eviction        TEXT NOT NULL DEFAULT 'lru' CHECK (eviction IN ('lru','lfu','fifo','ttl','random')),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  patterns        JSONB NOT NULL DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cache_entries (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT NOT NULL REFERENCES cache_policies(id) ON DELETE CASCADE,
  cache_key       TEXT NOT NULL,
  value_hash      TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  miss_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  last_accessed   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, cache_key)
);

CREATE TABLE IF NOT EXISTS cdn_distributions (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  name            TEXT NOT NULL,
  origin_url      TEXT NOT NULL,
  cdn_url         TEXT,
  provider        TEXT NOT NULL DEFAULT 'internal' CHECK (provider IN ('internal','cloudflare','aws_cloudfront','bunny','fastly')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deploying','suspended','deleted')),
  ssl_enabled     BOOLEAN NOT NULL DEFAULT true,
  compression     BOOLEAN NOT NULL DEFAULT true,
  cache_policy_id TEXT REFERENCES cache_policies(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cache_purge_requests (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT REFERENCES cache_policies(id) ON DELETE CASCADE,
  distribution_id TEXT REFERENCES cdn_distributions(id) ON DELETE CASCADE,
  purge_type      TEXT NOT NULL CHECK (purge_type IN ('all','pattern','key','tag')),
  pattern         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  purged_count    INTEGER DEFAULT 0,
  requested_by    TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cache_analytics (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT NOT NULL REFERENCES cache_policies(id) ON DELETE CASCADE,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  total_requests  BIGINT NOT NULL DEFAULT 0,
  cache_hits      BIGINT NOT NULL DEFAULT 0,
  cache_misses    BIGINT NOT NULL DEFAULT 0,
  hit_ratio       NUMERIC(5,4) DEFAULT 0,
  avg_latency_ms  INTEGER DEFAULT 0,
  bytes_served    BIGINT DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cache_policies_agent ON cache_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_cache_policies_type ON cache_policies(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_policies_enabled ON cache_policies(enabled);
CREATE INDEX IF NOT EXISTS idx_cache_entries_policy ON cache_entries(policy_id);
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_accessed ON cache_entries(last_accessed);
CREATE INDEX IF NOT EXISTS idx_cdn_distributions_agent ON cdn_distributions(agent_id);
CREATE INDEX IF NOT EXISTS idx_cdn_distributions_provider ON cdn_distributions(provider);
CREATE INDEX IF NOT EXISTS idx_cdn_distributions_status ON cdn_distributions(status);
CREATE INDEX IF NOT EXISTS idx_cdn_distributions_policy ON cdn_distributions(cache_policy_id);
CREATE INDEX IF NOT EXISTS idx_cache_purge_policy ON cache_purge_requests(policy_id);
CREATE INDEX IF NOT EXISTS idx_cache_purge_dist ON cache_purge_requests(distribution_id);
CREATE INDEX IF NOT EXISTS idx_cache_purge_status ON cache_purge_requests(status);
CREATE INDEX IF NOT EXISTS idx_cache_purge_type ON cache_purge_requests(purge_type);
CREATE INDEX IF NOT EXISTS idx_cache_analytics_policy ON cache_analytics(policy_id);
CREATE INDEX IF NOT EXISTS idx_cache_analytics_period ON cache_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cache_analytics_ratio ON cache_analytics(hit_ratio);
CREATE INDEX IF NOT EXISTS idx_cache_entries_hit ON cache_entries(hit_count);
CREATE INDEX IF NOT EXISTS idx_cache_purge_created ON cache_purge_requests(created_at);
