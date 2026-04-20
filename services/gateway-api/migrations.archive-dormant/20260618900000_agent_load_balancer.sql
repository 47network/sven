-- Batch 253: Load Balancer — distribute traffic across backends
CREATE TABLE IF NOT EXISTS agent_lb_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  lb_name VARCHAR(255) NOT NULL,
  algorithm VARCHAR(50) NOT NULL DEFAULT 'round_robin',
  health_check_interval_ms INTEGER NOT NULL DEFAULT 30000,
  sticky_sessions BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_lb_backends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_lb_configs(id),
  backend_host VARCHAR(500) NOT NULL,
  backend_port INTEGER NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  max_connections INTEGER DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'healthy',
  last_health_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_lb_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_lb_configs(id),
  requests_total BIGINT NOT NULL DEFAULT 0,
  active_connections INTEGER NOT NULL DEFAULT 0,
  avg_response_ms NUMERIC(10,2),
  error_rate NUMERIC(5,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lb_configs_agent ON agent_lb_configs(agent_id);
CREATE INDEX idx_lb_backends_config ON agent_lb_backends(config_id);
CREATE INDEX idx_lb_metrics_config ON agent_lb_metrics(config_id);
