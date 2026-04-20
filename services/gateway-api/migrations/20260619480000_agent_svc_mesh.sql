-- Batch 311: Service Mesh vertical
CREATE TABLE IF NOT EXISTS agent_svc_mesh_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  mesh_type TEXT NOT NULL DEFAULT 'istio' CHECK (mesh_type IN ('istio','linkerd','consul','envoy')),
  mtls_enabled BOOLEAN NOT NULL DEFAULT true,
  tracing_enabled BOOLEAN NOT NULL DEFAULT true,
  retry_budget_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_svc_mesh_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_svc_mesh_configs(id),
  source_service TEXT NOT NULL,
  dest_service TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  retries INTEGER NOT NULL DEFAULT 3,
  circuit_breaker BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','draining')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_svc_mesh_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_svc_mesh_configs(id),
  policy_type TEXT NOT NULL CHECK (policy_type IN ('rate_limit','auth','cors','header_transform')),
  target_service TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_svc_mesh_configs_agent ON agent_svc_mesh_configs(agent_id);
CREATE INDEX idx_svc_mesh_routes_config ON agent_svc_mesh_routes(config_id);
CREATE INDEX idx_svc_mesh_policies_config ON agent_svc_mesh_policies(config_id);
