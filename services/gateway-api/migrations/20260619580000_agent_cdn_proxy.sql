CREATE TABLE IF NOT EXISTS agent_cdn_proxy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  cdn_name TEXT NOT NULL,
  origin_url TEXT NOT NULL,
  cache_policy TEXT NOT NULL DEFAULT 'aggressive',
  max_cache_size_mb INTEGER DEFAULT 10240,
  edge_locations TEXT[] DEFAULT ARRAY['eu-west', 'us-east'],
  ssl_enabled BOOLEAN DEFAULT true,
  compression_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cdn_cache_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cdn_proxy_configs(id),
  cache_key TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  hit_count BIGINT DEFAULT 0,
  ttl INTEGER DEFAULT 3600,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cdn_purge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cdn_proxy_configs(id),
  purge_pattern TEXT NOT NULL,
  purge_type TEXT NOT NULL DEFAULT 'path',
  status TEXT NOT NULL DEFAULT 'pending',
  entries_purged INTEGER DEFAULT 0,
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_cdn_cache_config ON agent_cdn_cache_entries(config_id);
CREATE INDEX idx_cdn_purge_config ON agent_cdn_purge_requests(config_id);
