-- Batch 209: cache_manager
CREATE TABLE IF NOT EXISTS agent_cache_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  store_type VARCHAR(50) NOT NULL CHECK (store_type IN ('redis','memcached','in_memory','distributed','cdn_edge','sqlite','lru','tiered')),
  connection_config JSONB NOT NULL DEFAULT '{}',
  max_memory_mb INT DEFAULT 256,
  eviction_policy VARCHAR(30) NOT NULL DEFAULT 'lru' CHECK (eviction_policy IN ('lru','lfu','fifo','ttl','random','none')),
  status VARCHAR(30) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','warming','ready','degraded','error','draining')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, name)
);

CREATE TABLE IF NOT EXISTS agent_cache_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES agent_cache_stores(id),
  key_pattern VARCHAR(500) NOT NULL,
  ttl_seconds INT NOT NULL DEFAULT 3600,
  invalidation_strategy VARCHAR(30) NOT NULL DEFAULT 'ttl' CHECK (invalidation_strategy IN ('ttl','event','manual','write_through','write_behind')),
  compress BOOLEAN DEFAULT false,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_cache_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES agent_cache_stores(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  hits BIGINT DEFAULT 0,
  misses BIGINT DEFAULT 0,
  evictions BIGINT DEFAULT 0,
  memory_used_mb NUMERIC(10,2) DEFAULT 0,
  avg_latency_ms NUMERIC(10,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cache_stores_agent ON agent_cache_stores(agent_id);
CREATE INDEX idx_cache_stores_status ON agent_cache_stores(status);
CREATE INDEX idx_cache_policies_store ON agent_cache_policies(store_id);
CREATE INDEX idx_cache_metrics_store ON agent_cache_metrics(store_id);
CREATE INDEX idx_cache_metrics_period ON agent_cache_metrics(period_start);
