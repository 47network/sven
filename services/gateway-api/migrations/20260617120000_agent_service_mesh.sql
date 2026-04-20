-- Batch 75: Agent Service Mesh & Discovery
-- Service registration, discovery, health checking and traffic management

CREATE TABLE IF NOT EXISTS service_registry (
  id            TEXT PRIMARY KEY,
  service_name  TEXT NOT NULL,
  version       TEXT NOT NULL DEFAULT '1.0.0',
  protocol      TEXT NOT NULL CHECK (protocol IN ('http','grpc','ws','tcp','nats')),
  host          TEXT NOT NULL,
  port          INTEGER NOT NULL,
  health_path   TEXT NOT NULL DEFAULT '/health',
  status        TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','healthy','degraded','unhealthy','deregistered')),
  tags          JSONB NOT NULL DEFAULT '[]',
  metadata      JSONB NOT NULL DEFAULT '{}',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_endpoints (
  id          TEXT PRIMARY KEY,
  service_id  TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  method      TEXT NOT NULL DEFAULT 'GET',
  description TEXT,
  rate_limit  INTEGER,
  timeout_ms  INTEGER NOT NULL DEFAULT 5000,
  retries     INTEGER NOT NULL DEFAULT 3,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_dependencies (
  id           TEXT PRIMARY KEY,
  service_id   TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  depends_on   TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  dep_type     TEXT NOT NULL DEFAULT 'required' CHECK (dep_type IN ('required','optional','weak')),
  min_version  TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_health_checks (
  id           TEXT PRIMARY KEY,
  service_id   TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  check_type   TEXT NOT NULL CHECK (check_type IN ('http','tcp','grpc','script','nats')),
  interval_sec INTEGER NOT NULL DEFAULT 30,
  timeout_ms   INTEGER NOT NULL DEFAULT 5000,
  last_status  TEXT NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('passing','warning','critical','unknown')),
  last_output  TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  checked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mesh_traffic_policies (
  id              TEXT PRIMARY KEY,
  policy_name     TEXT NOT NULL,
  source_service  TEXT,
  target_service  TEXT,
  strategy        TEXT NOT NULL DEFAULT 'round_robin' CHECK (strategy IN ('round_robin','weighted','least_conn','random','consistent_hash')),
  circuit_breaker JSONB NOT NULL DEFAULT '{}',
  retry_policy    JSONB NOT NULL DEFAULT '{}',
  timeout_policy  JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_svc_registry_name ON service_registry(service_name);
CREATE INDEX IF NOT EXISTS idx_svc_registry_status ON service_registry(status);
CREATE INDEX IF NOT EXISTS idx_svc_registry_protocol ON service_registry(protocol);
CREATE INDEX IF NOT EXISTS idx_svc_registry_heartbeat ON service_registry(last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_svc_endpoints_service ON service_endpoints(service_id);
CREATE INDEX IF NOT EXISTS idx_svc_endpoints_path ON service_endpoints(path);
CREATE INDEX IF NOT EXISTS idx_svc_endpoints_method ON service_endpoints(method);

CREATE INDEX IF NOT EXISTS idx_svc_deps_service ON service_dependencies(service_id);
CREATE INDEX IF NOT EXISTS idx_svc_deps_target ON service_dependencies(depends_on);
CREATE INDEX IF NOT EXISTS idx_svc_deps_type ON service_dependencies(dep_type);

CREATE INDEX IF NOT EXISTS idx_svc_health_service ON service_health_checks(service_id);
CREATE INDEX IF NOT EXISTS idx_svc_health_status ON service_health_checks(last_status);
CREATE INDEX IF NOT EXISTS idx_svc_health_type ON service_health_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_svc_health_checked ON service_health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_mesh_traffic_name ON mesh_traffic_policies(policy_name);
CREATE INDEX IF NOT EXISTS idx_mesh_traffic_source ON mesh_traffic_policies(source_service);
CREATE INDEX IF NOT EXISTS idx_mesh_traffic_target ON mesh_traffic_policies(target_service);
CREATE INDEX IF NOT EXISTS idx_mesh_traffic_active ON mesh_traffic_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_mesh_traffic_strategy ON mesh_traffic_policies(strategy);
