-- Batch 191: Proxy Router — reverse proxy and traffic routing
BEGIN;

CREATE TABLE IF NOT EXISTS agent_proxy_upstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  upstream_type VARCHAR(50) NOT NULL CHECK (upstream_type IN ('http','https','tcp','udp','grpc','websocket')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','draining','unhealthy','disabled','maintenance')),
  target_url VARCHAR(1000) NOT NULL,
  health_check_path VARCHAR(500),
  health_check_interval_seconds INT DEFAULT 30,
  weight INT DEFAULT 100,
  max_connections INT DEFAULT 1000,
  timeout_seconds INT DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_proxy_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upstream_id UUID NOT NULL REFERENCES agent_proxy_upstreams(id) ON DELETE CASCADE,
  path_pattern VARCHAR(500) NOT NULL,
  route_type VARCHAR(50) NOT NULL CHECK (route_type IN ('prefix','exact','regex','host_header','weighted','canary')),
  priority INT DEFAULT 100,
  strip_prefix BOOLEAN DEFAULT false,
  rate_limit_rps INT,
  cors_enabled BOOLEAN DEFAULT false,
  auth_required BOOLEAN DEFAULT false,
  headers_add JSONB DEFAULT '{}',
  headers_remove TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_proxy_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES agent_proxy_routes(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(1000) NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  client_ip VARCHAR(45),
  user_agent VARCHAR(500),
  bytes_sent BIGINT DEFAULT 0,
  upstream_response_time_ms INT,
  cache_status VARCHAR(20) CHECK (cache_status IN ('hit','miss','bypass','expired','stale','revalidated')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_proxy_upstreams_agent ON agent_proxy_upstreams(agent_id);
CREATE INDEX idx_agent_proxy_routes_upstream ON agent_proxy_routes(upstream_id);
CREATE INDEX idx_agent_proxy_access_logs_route ON agent_proxy_access_logs(route_id);
CREATE INDEX idx_agent_proxy_upstreams_status ON agent_proxy_upstreams(status);
CREATE INDEX idx_agent_proxy_access_logs_created ON agent_proxy_access_logs(created_at);

COMMIT;
