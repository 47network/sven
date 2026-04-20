-- Batch 151: Agent Service Discovery
-- Auto-discover and register agent capabilities in the mesh

CREATE TABLE IF NOT EXISTS service_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('skill','api','webhook','stream','cron','queue','rpc')),
  endpoint TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  healthy BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat TIMESTAMPTZ,
  capabilities JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_probes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  probe_type TEXT NOT NULL CHECK (probe_type IN ('health','capability','latency','load','version')),
  result TEXT NOT NULL CHECK (result IN ('pass','fail','timeout','degraded')),
  latency_ms REAL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  depends_on_service_id UUID NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_registry_agent ON service_registry(agent_id);
CREATE INDEX idx_service_registry_type ON service_registry(service_type);
CREATE INDEX idx_service_registry_healthy ON service_registry(healthy) WHERE healthy = true;
CREATE INDEX idx_discovery_probes_registry ON discovery_probes(registry_id);
CREATE INDEX idx_discovery_probes_result ON discovery_probes(result);
CREATE INDEX idx_service_dependencies_svc ON service_dependencies(service_id);
