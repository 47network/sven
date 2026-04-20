CREATE TABLE IF NOT EXISTS agent_lb_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  lb_name TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'round_robin',
  health_check_path TEXT DEFAULT '/health',
  health_check_interval INTEGER DEFAULT 10,
  sticky_sessions BOOLEAN DEFAULT false,
  max_backends INTEGER DEFAULT 100,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_lb_backends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_lb_orchestrator_configs(id),
  backend_url TEXT NOT NULL,
  weight INTEGER DEFAULT 100,
  max_connections INTEGER DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'healthy',
  last_health_check TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_lb_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_lb_orchestrator_configs(id),
  rule_name TEXT NOT NULL,
  match_path TEXT,
  match_header TEXT,
  target_backend_id UUID REFERENCES agent_lb_backends(id),
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_lb_backends_config ON agent_lb_backends(config_id);
CREATE INDEX idx_lb_rules_config ON agent_lb_rules(config_id);
