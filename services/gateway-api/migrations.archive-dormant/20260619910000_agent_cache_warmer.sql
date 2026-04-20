-- Batch 354: Cache Warmer — proactive cache population and refresh
CREATE TABLE IF NOT EXISTS agent_cache_warmer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  cache_backend TEXT NOT NULL DEFAULT 'redis' CHECK (cache_backend IN ('redis','memcached','in_memory','distributed')),
  warmup_strategy TEXT NOT NULL DEFAULT 'lazy' CHECK (warmup_strategy IN ('lazy','eager','predictive','scheduled')),
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  max_entries INTEGER NOT NULL DEFAULT 10000,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cache_warmer_configs_agent ON agent_cache_warmer_configs(agent_id);

CREATE TABLE IF NOT EXISTS agent_cache_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cache_warmer_configs(id),
  cache_key TEXT NOT NULL,
  cache_value JSONB,
  hit_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  warmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, cache_key)
);
CREATE INDEX idx_cache_entries_config ON agent_cache_entries(config_id);
CREATE INDEX idx_cache_entries_expires ON agent_cache_entries(expires_at);

CREATE TABLE IF NOT EXISTS agent_cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cache_warmer_configs(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_hits INTEGER NOT NULL DEFAULT 0,
  total_misses INTEGER NOT NULL DEFAULT 0,
  hit_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  evictions INTEGER NOT NULL DEFAULT 0,
  warmup_duration_ms INTEGER,
  entries_warmed INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cache_stats_config ON agent_cache_stats(config_id);
