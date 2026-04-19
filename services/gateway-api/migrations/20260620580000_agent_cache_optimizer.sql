CREATE TABLE IF NOT EXISTS agent_cache_optimizer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  cache_backend TEXT NOT NULL DEFAULT 'redis',
  max_memory_mb INTEGER NOT NULL DEFAULT 512,
  eviction_policy TEXT NOT NULL DEFAULT 'lru',
  ttl_default_seconds INTEGER NOT NULL DEFAULT 3600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cache_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cache_optimizer_configs(id),
  cache_key TEXT NOT NULL,
  value_size_bytes INTEGER NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cache_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cache_optimizer_configs(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  hit_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  memory_usage_mb NUMERIC(10,2) NOT NULL DEFAULT 0,
  eviction_count INTEGER NOT NULL DEFAULT 0,
  recommendations JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_agent_cache_entries_config ON agent_cache_entries(config_id);
CREATE INDEX idx_agent_cache_analytics_config ON agent_cache_analytics(config_id);
