-- Batch 119 — Service Mesh
-- Manages service mesh routing, sidecars, and traffic policies

CREATE TABLE IF NOT EXISTS agent_mesh_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  protocol TEXT NOT NULL DEFAULT 'http' CHECK (protocol IN ('http','grpc','tcp','udp')),
  port INT NOT NULL,
  target_port INT NOT NULL,
  sidecar_enabled BOOLEAN NOT NULL DEFAULT true,
  mtls_mode TEXT NOT NULL DEFAULT 'strict' CHECK (mtls_mode IN ('strict','permissive','disabled')),
  health_check_path TEXT DEFAULT '/health',
  replicas INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mesh_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES agent_mesh_services(id) ON DELETE CASCADE,
  match_path TEXT NOT NULL DEFAULT '/',
  match_method TEXT DEFAULT 'GET',
  destination_service_id UUID NOT NULL REFERENCES agent_mesh_services(id),
  weight INT NOT NULL DEFAULT 100 CHECK (weight >= 0 AND weight <= 100),
  timeout_ms INT NOT NULL DEFAULT 30000,
  retry_attempts INT NOT NULL DEFAULT 3,
  circuit_breaker_threshold INT NOT NULL DEFAULT 5,
  rate_limit_rps INT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mesh_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('traffic','security','observability','fault_injection')),
  target_service_id UUID REFERENCES agent_mesh_services(id),
  rules JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mesh_services_agent ON agent_mesh_services(agent_id);
CREATE INDEX idx_mesh_services_namespace ON agent_mesh_services(namespace);
CREATE INDEX idx_mesh_routes_service ON agent_mesh_routes(service_id);
CREATE INDEX idx_mesh_routes_dest ON agent_mesh_routes(destination_service_id);
CREATE INDEX idx_mesh_policies_agent ON agent_mesh_policies(agent_id);
CREATE INDEX idx_mesh_policies_type ON agent_mesh_policies(policy_type);
