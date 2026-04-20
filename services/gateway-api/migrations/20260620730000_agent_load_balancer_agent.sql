-- Batch 436: Load Balancer Agent
CREATE TABLE IF NOT EXISTS agent_load_balancer_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'round_robin' CHECK (algorithm IN ('round_robin','least_connections','weighted','ip_hash','consistent_hash','random')),
  max_backends INTEGER NOT NULL DEFAULT 50,
  drain_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_lb_backends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_load_balancer_agent_configs(id),
  address TEXT NOT NULL,
  port INTEGER NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  max_connections INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','unhealthy','draining','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_lb_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backend_id UUID NOT NULL REFERENCES agent_lb_backends(id),
  status TEXT NOT NULL DEFAULT 'pass' CHECK (status IN ('pass','fail','timeout')),
  response_time_ms INTEGER,
  status_code INTEGER,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_load_balancer_agent_configs_agent ON agent_load_balancer_agent_configs(agent_id);
CREATE INDEX idx_agent_lb_backends_config ON agent_lb_backends(config_id);
CREATE INDEX idx_agent_lb_health_checks_backend ON agent_lb_health_checks(backend_id);
