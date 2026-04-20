-- Batch 241: API Gateway Manager
-- API gateway configuration, route management, versioning

CREATE TABLE IF NOT EXISTS agent_api_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  route_path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  upstream_url TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  auth_required BOOLEAN NOT NULL DEFAULT true,
  rate_limit_rps INTEGER DEFAULT 100,
  timeout_ms INTEGER DEFAULT 30000,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_api_consumers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  consumer_name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  allowed_routes TEXT[] DEFAULT '{}',
  rate_limit_rps INTEGER DEFAULT 60,
  quota_daily INTEGER DEFAULT 10000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_api_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES agent_api_routes(id),
  consumer_id UUID REFERENCES agent_api_consumers(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  request_size_bytes INTEGER DEFAULT 0,
  response_size_bytes INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_api_routes_agent ON agent_api_routes(agent_id);
CREATE INDEX idx_api_routes_path ON agent_api_routes(route_path);
CREATE INDEX idx_api_consumers_agent ON agent_api_consumers(agent_id);
CREATE INDEX idx_api_consumers_status ON agent_api_consumers(status);
CREATE INDEX idx_api_analytics_route ON agent_api_analytics(route_id);
CREATE INDEX idx_api_analytics_consumer ON agent_api_analytics(consumer_id);
CREATE INDEX idx_api_analytics_ts ON agent_api_analytics(timestamp);
