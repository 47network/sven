-- Batch 243: Proxy Manager — reverse proxy + forward proxy orchestration
CREATE TABLE IF NOT EXISTS agent_proxy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  proxy_type VARCHAR(30) NOT NULL DEFAULT 'reverse',
  upstream_url TEXT NOT NULL,
  listen_port INTEGER NOT NULL,
  ssl_enabled BOOLEAN DEFAULT false,
  cache_enabled BOOLEAN DEFAULT false,
  rate_limit INTEGER,
  health_check_path VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_proxy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_proxy_configs(id),
  rule_type VARCHAR(30) NOT NULL,
  path_pattern VARCHAR(500),
  rewrite_target VARCHAR(500),
  headers JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_proxy_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_proxy_configs(id),
  client_ip VARCHAR(45),
  method VARCHAR(10),
  path TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  bytes_sent BIGINT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_proxy_configs_agent ON agent_proxy_configs(agent_id);
CREATE INDEX idx_proxy_rules_config ON agent_proxy_rules(config_id);
CREATE INDEX idx_proxy_logs_config ON agent_proxy_access_logs(config_id);
CREATE INDEX idx_proxy_logs_created ON agent_proxy_access_logs(created_at);
