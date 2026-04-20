CREATE TABLE IF NOT EXISTS agent_service_mesh_router_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  mesh_name TEXT NOT NULL,
  routing_strategy TEXT NOT NULL DEFAULT 'round_robin',
  health_check_interval_ms INTEGER NOT NULL DEFAULT 30000,
  circuit_breaker_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_mesh_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_service_mesh_router_configs(id),
  service_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  health_status TEXT NOT NULL DEFAULT 'healthy',
  last_health_check TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS agent_mesh_traffic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_service_mesh_router_configs(id),
  rule_name TEXT NOT NULL,
  match_criteria JSONB NOT NULL DEFAULT '{}',
  action JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_mesh_services_config ON agent_mesh_services(config_id);
CREATE INDEX idx_agent_mesh_traffic_rules_config ON agent_mesh_traffic_rules(config_id);
