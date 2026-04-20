-- Batch 435: Request Router
CREATE TABLE IF NOT EXISTS agent_request_router_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  routing_strategy TEXT NOT NULL DEFAULT 'round_robin' CHECK (routing_strategy IN ('round_robin','weighted','least_connections','hash','random','priority')),
  health_check_interval_ms INTEGER NOT NULL DEFAULT 30000,
  sticky_sessions BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_route_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_request_router_configs(id),
  path_pattern TEXT NOT NULL,
  target_service TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_route_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_route_rules(id),
  requests_total BIGINT NOT NULL DEFAULT 0,
  requests_failed BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_request_router_configs_agent ON agent_request_router_configs(agent_id);
CREATE INDEX idx_agent_route_rules_config ON agent_route_rules(config_id);
CREATE INDEX idx_agent_route_metrics_rule ON agent_route_metrics(rule_id);
