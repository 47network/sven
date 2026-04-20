-- Batch 83: Agent Service Discovery
-- Tables for service registry, health checks, endpoints, dependencies, and discovery events

CREATE TABLE IF NOT EXISTS service_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('api','worker','scheduler','gateway','adapter','processor','monitor','custom')),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','healthy','degraded','unhealthy','deregistered')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'http' CHECK (protocol IN ('http','https','grpc','ws','wss','tcp','nats')),
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  registered_by TEXT,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_health_checks (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('http','tcp','script','heartbeat','grpc')),
  endpoint TEXT,
  interval_seconds INTEGER DEFAULT 30,
  timeout_seconds INTEGER DEFAULT 5,
  healthy_threshold INTEGER DEFAULT 3,
  unhealthy_threshold INTEGER DEFAULT 3,
  last_status TEXT CHECK (last_status IN ('passing','warning','failing','unknown')),
  last_checked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_endpoints (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  description TEXT,
  auth_required BOOLEAN DEFAULT false,
  rate_limit INTEGER,
  schema_request JSONB,
  schema_response JSONB,
  deprecated BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_dependencies (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  depends_on TEXT NOT NULL REFERENCES service_registry(id),
  dependency_type TEXT NOT NULL DEFAULT 'required' CHECK (dependency_type IN ('required','optional','soft','development')),
  version_constraint TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, depends_on)
);

CREATE TABLE IF NOT EXISTS discovery_events (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_registry(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('registered','deregistered','healthy','degraded','unhealthy','endpoint_added','endpoint_removed','dependency_added','config_changed')),
  details JSONB DEFAULT '{}',
  triggered_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for service_registry
CREATE INDEX idx_service_registry_name ON service_registry(name);
CREATE INDEX idx_service_registry_type ON service_registry(service_type);
CREATE INDEX idx_service_registry_status ON service_registry(status);
CREATE INDEX idx_service_registry_host ON service_registry(host);
CREATE INDEX idx_service_registry_heartbeat ON service_registry(last_heartbeat);

-- Indexes for service_health_checks
CREATE INDEX idx_health_checks_service ON service_health_checks(service_id);
CREATE INDEX idx_health_checks_type ON service_health_checks(check_type);
CREATE INDEX idx_health_checks_status ON service_health_checks(last_status);
CREATE INDEX idx_health_checks_checked ON service_health_checks(last_checked_at);

-- Indexes for service_endpoints
CREATE INDEX idx_service_endpoints_service ON service_endpoints(service_id);
CREATE INDEX idx_service_endpoints_path ON service_endpoints(path);
CREATE INDEX idx_service_endpoints_method ON service_endpoints(method);
CREATE INDEX idx_service_endpoints_deprecated ON service_endpoints(deprecated);

-- Indexes for service_dependencies
CREATE INDEX idx_service_deps_service ON service_dependencies(service_id);
CREATE INDEX idx_service_deps_depends ON service_dependencies(depends_on);
CREATE INDEX idx_service_deps_type ON service_dependencies(dependency_type);

-- Indexes for discovery_events
CREATE INDEX idx_discovery_events_service ON discovery_events(service_id);
CREATE INDEX idx_discovery_events_type ON discovery_events(event_type);
CREATE INDEX idx_discovery_events_created ON discovery_events(created_at DESC);
