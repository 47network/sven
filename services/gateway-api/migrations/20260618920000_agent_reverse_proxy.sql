-- Batch 255: Reverse Proxy — request routing and upstream management
CREATE TABLE IF NOT EXISTS agent_proxy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  proxy_name VARCHAR(255) NOT NULL,
  listen_port INTEGER NOT NULL,
  ssl_enabled BOOLEAN NOT NULL DEFAULT true,
  compression_enabled BOOLEAN NOT NULL DEFAULT true,
  request_buffering BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_proxy_upstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_proxy_configs(id),
  upstream_name VARCHAR(255) NOT NULL,
  upstream_url VARCHAR(1000) NOT NULL,
  path_prefix VARCHAR(500) NOT NULL DEFAULT '/',
  rewrite_path BOOLEAN NOT NULL DEFAULT false,
  headers_add JSONB DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_proxy_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_proxy_configs(id),
  client_ip INET,
  method VARCHAR(10),
  request_path VARCHAR(1000),
  upstream_name VARCHAR(255),
  status_code INTEGER,
  response_time_ms INTEGER,
  bytes_sent BIGINT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_proxy_configs_agent ON agent_proxy_configs(agent_id);
CREATE INDEX idx_proxy_upstreams_config ON agent_proxy_upstreams(config_id);
CREATE INDEX idx_proxy_logs_config ON agent_proxy_access_logs(config_id);
