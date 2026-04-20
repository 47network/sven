-- Batch 252: Edge Router
CREATE TABLE IF NOT EXISTS agent_edge_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  router_name TEXT NOT NULL,
  edge_location TEXT NOT NULL,
  upstream_targets JSONB NOT NULL DEFAULT '[]',
  health_check_path TEXT DEFAULT '/health',
  tls_mode TEXT NOT NULL DEFAULT 'terminate' CHECK (tls_mode IN ('terminate', 'passthrough', 'mutual')),
  compression_enabled BOOLEAN DEFAULT true,
  cache_ttl_seconds INTEGER DEFAULT 300,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'standby', 'maintenance', 'error')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_edge_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_edge_configs(id),
  path_pattern TEXT NOT NULL,
  upstream_target TEXT NOT NULL,
  methods TEXT[] DEFAULT ARRAY['GET','POST','PUT','DELETE'],
  strip_prefix BOOLEAN DEFAULT false,
  rate_limit_rps INTEGER,
  timeout_ms INTEGER DEFAULT 30000,
  retry_count INTEGER DEFAULT 2,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_edge_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_edge_configs(id),
  client_ip TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  upstream_target TEXT,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  cache_status TEXT CHECK (cache_status IN ('hit', 'miss', 'bypass', 'expired')),
  bytes_sent BIGINT DEFAULT 0,
  tls_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_edge_configs_agent ON agent_edge_configs(agent_id);
CREATE INDEX idx_edge_routes_config ON agent_edge_routes(config_id);
CREATE INDEX idx_edge_access_config ON agent_edge_access_logs(config_id);
