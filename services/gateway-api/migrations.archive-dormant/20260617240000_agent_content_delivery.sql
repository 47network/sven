-- Batch 87: Agent Content Delivery
-- CDN-like content delivery for agent-generated assets

CREATE TABLE IF NOT EXISTS cdn_origins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('storage','api','compute','external','mirror')),
  base_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','degraded','maintenance')),
  region TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  health_check_url TEXT,
  last_health_check TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cdn_assets (
  id TEXT PRIMARY KEY,
  origin_id TEXT NOT NULL REFERENCES cdn_origins(id) ON DELETE CASCADE,
  asset_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum TEXT,
  cache_control TEXT DEFAULT 'public, max-age=3600',
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  version INTEGER NOT NULL DEFAULT 1,
  is_immutable BOOLEAN NOT NULL DEFAULT false,
  access_count BIGINT NOT NULL DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cdn_cache_entries (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES cdn_assets(id) ON DELETE CASCADE,
  edge_location TEXT NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'fresh' CHECK (status IN ('fresh','stale','revalidating','purged')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cdn_purge_requests (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL CHECK (request_type IN ('path','prefix','tag','origin','all')),
  pattern TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  affected_count INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT,
  reason TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cdn_analytics (
  id TEXT PRIMARY KEY,
  asset_id TEXT REFERENCES cdn_assets(id) ON DELETE SET NULL,
  edge_location TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('hit','miss','bypass','error','redirect')),
  response_time_ms NUMERIC(10,2),
  bytes_transferred BIGINT NOT NULL DEFAULT 0,
  client_region TEXT,
  user_agent TEXT,
  status_code INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cdn_origins_type ON cdn_origins(origin_type);
CREATE INDEX idx_cdn_origins_status ON cdn_origins(status);
CREATE INDEX idx_cdn_origins_region ON cdn_origins(region);
CREATE INDEX idx_cdn_assets_origin ON cdn_assets(origin_id);
CREATE INDEX idx_cdn_assets_path ON cdn_assets(asset_path);
CREATE INDEX idx_cdn_assets_type ON cdn_assets(content_type);
CREATE INDEX idx_cdn_assets_accessed ON cdn_assets(last_accessed DESC);
CREATE INDEX idx_cdn_assets_access_count ON cdn_assets(access_count DESC);
CREATE INDEX idx_cdn_cache_asset ON cdn_cache_entries(asset_id);
CREATE INDEX idx_cdn_cache_location ON cdn_cache_entries(edge_location);
CREATE INDEX idx_cdn_cache_expires ON cdn_cache_entries(expires_at);
CREATE INDEX idx_cdn_cache_status ON cdn_cache_entries(status);
CREATE INDEX idx_cdn_purge_type ON cdn_purge_requests(request_type);
CREATE INDEX idx_cdn_purge_status ON cdn_purge_requests(status);
CREATE INDEX idx_cdn_purge_created ON cdn_purge_requests(created_at DESC);
CREATE INDEX idx_cdn_analytics_asset ON cdn_analytics(asset_id);
CREATE INDEX idx_cdn_analytics_type ON cdn_analytics(request_type);
CREATE INDEX idx_cdn_analytics_location ON cdn_analytics(edge_location);
CREATE INDEX idx_cdn_analytics_created ON cdn_analytics(created_at DESC);
CREATE INDEX idx_cdn_analytics_status ON cdn_analytics(status_code);
