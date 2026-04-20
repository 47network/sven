-- Batch 389: Service Mesh Manager
CREATE TABLE IF NOT EXISTS agent_service_mesh_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  mesh_name TEXT NOT NULL DEFAULT 'default',
  discovery_mode TEXT DEFAULT 'auto' CHECK (discovery_mode IN ('auto','manual','dns','consul')),
  load_balance_strategy TEXT DEFAULT 'round_robin',
  circuit_breaker_enabled BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mesh_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_service_mesh_manager_configs(id),
  service_name TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  endpoints JSONB DEFAULT '[]',
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','degraded','unhealthy')),
  instance_count INT DEFAULT 1,
  traffic_weight DECIMAL(5,2) DEFAULT 100.00,
  metadata JSONB DEFAULT '{}',
  registered_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mesh_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_service_mesh_manager_configs(id),
  source_service TEXT NOT NULL,
  destination_service TEXT NOT NULL,
  match_rules JSONB DEFAULT '{}',
  retry_policy JSONB DEFAULT '{}',
  timeout_ms INT DEFAULT 30000,
  circuit_breaker JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mesh_configs_agent ON agent_service_mesh_manager_configs(agent_id);
CREATE INDEX idx_mesh_services_config ON agent_mesh_services(config_id);
CREATE INDEX idx_mesh_services_status ON agent_mesh_services(health_status);
CREATE INDEX idx_mesh_routes_config ON agent_mesh_routes(config_id);
CREATE INDEX idx_mesh_routes_src ON agent_mesh_routes(source_service);
