-- Batch 258: Service Mesh
CREATE TABLE IF NOT EXISTS agent_mesh_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  mesh_name VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) DEFAULT 'default',
  mtls_enabled BOOLEAN DEFAULT true,
  sidecar_mode VARCHAR(50) DEFAULT 'automatic',
  observability_level VARCHAR(50) DEFAULT 'standard',
  retry_policy JSONB DEFAULT '{}',
  circuit_breaker JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_mesh_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesh_id UUID NOT NULL REFERENCES agent_mesh_configs(id),
  service_name VARCHAR(255) NOT NULL,
  service_port INTEGER NOT NULL,
  protocol VARCHAR(50) DEFAULT 'http',
  version VARCHAR(50) DEFAULT 'v1',
  replicas INTEGER DEFAULT 1,
  health_check_path VARCHAR(255) DEFAULT '/health',
  traffic_policy JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_mesh_traffic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesh_id UUID NOT NULL REFERENCES agent_mesh_configs(id),
  rule_name VARCHAR(255) NOT NULL,
  source_service VARCHAR(255),
  destination_service VARCHAR(255) NOT NULL,
  match_criteria JSONB DEFAULT '{}',
  weight_percent INTEGER DEFAULT 100,
  timeout_ms INTEGER DEFAULT 30000,
  retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mesh_configs_agent ON agent_mesh_configs(agent_id);
CREATE INDEX idx_mesh_services_mesh ON agent_mesh_services(mesh_id);
CREATE INDEX idx_mesh_traffic_rules_mesh ON agent_mesh_traffic_rules(mesh_id);
