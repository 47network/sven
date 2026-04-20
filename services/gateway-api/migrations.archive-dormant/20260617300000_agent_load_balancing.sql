-- Batch 93: Agent Load Balancing
-- Load balancers, backends, routing rules, health probes, and traffic metrics

CREATE TABLE IF NOT EXISTS lb_instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'round_robin' CHECK (algorithm IN ('round_robin','weighted','least_connections','ip_hash','random','adaptive')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draining','standby','failed','maintenance')),
  sticky_sessions BOOLEAN NOT NULL DEFAULT false,
  session_ttl_seconds INTEGER DEFAULT 3600,
  max_connections INTEGER DEFAULT 10000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lb_backends (
  id TEXT PRIMARY KEY,
  lb_id TEXT NOT NULL REFERENCES lb_instances(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','unhealthy','draining','disabled')),
  active_connections INTEGER NOT NULL DEFAULT 0,
  total_requests BIGINT NOT NULL DEFAULT 0,
  error_count BIGINT NOT NULL DEFAULT 0,
  avg_response_ms NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lb_routing_rules (
  id TEXT PRIMARY KEY,
  lb_id TEXT NOT NULL REFERENCES lb_instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('path','header','query','method','host','cookie')),
  match_pattern TEXT NOT NULL,
  target_backend_id TEXT REFERENCES lb_backends(id),
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lb_health_probes (
  id TEXT PRIMARY KEY,
  backend_id TEXT NOT NULL REFERENCES lb_backends(id) ON DELETE CASCADE,
  probe_type TEXT NOT NULL DEFAULT 'http' CHECK (probe_type IN ('http','tcp','grpc','custom')),
  endpoint TEXT NOT NULL DEFAULT '/health',
  interval_seconds INTEGER NOT NULL DEFAULT 10,
  timeout_ms INTEGER NOT NULL DEFAULT 3000,
  healthy_threshold INTEGER NOT NULL DEFAULT 3,
  unhealthy_threshold INTEGER NOT NULL DEFAULT 3,
  last_check_at TIMESTAMPTZ,
  last_status TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lb_traffic_metrics (
  id TEXT PRIMARY KEY,
  lb_id TEXT NOT NULL REFERENCES lb_instances(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_requests BIGINT NOT NULL DEFAULT 0,
  successful_requests BIGINT NOT NULL DEFAULT 0,
  failed_requests BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC DEFAULT 0,
  p99_latency_ms NUMERIC DEFAULT 0,
  bytes_in BIGINT NOT NULL DEFAULT 0,
  bytes_out BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lbi_name ON lb_instances(name);
CREATE INDEX idx_lbi_status ON lb_instances(status);
CREATE INDEX idx_lbi_algo ON lb_instances(algorithm);
CREATE INDEX idx_lbi_created ON lb_instances(created_at DESC);
CREATE INDEX idx_lbb_lb ON lb_backends(lb_id);
CREATE INDEX idx_lbb_status ON lb_backends(status);
CREATE INDEX idx_lbb_connections ON lb_backends(active_connections);
CREATE INDEX idx_lbb_errors ON lb_backends(error_count DESC);
CREATE INDEX idx_lbr_lb ON lb_routing_rules(lb_id);
CREATE INDEX idx_lbr_type ON lb_routing_rules(match_type);
CREATE INDEX idx_lbr_priority ON lb_routing_rules(priority DESC);
CREATE INDEX idx_lbr_active ON lb_routing_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_lbhp_backend ON lb_health_probes(backend_id);
CREATE INDEX idx_lbhp_type ON lb_health_probes(probe_type);
CREATE INDEX idx_lbhp_last ON lb_health_probes(last_check_at DESC);
CREATE INDEX idx_lbhp_created ON lb_health_probes(created_at DESC);
CREATE INDEX idx_lbtm_lb ON lb_traffic_metrics(lb_id);
CREATE INDEX idx_lbtm_period ON lb_traffic_metrics(period_start, period_end);
CREATE INDEX idx_lbtm_requests ON lb_traffic_metrics(total_requests DESC);
CREATE INDEX idx_lbtm_created ON lb_traffic_metrics(created_at DESC);
