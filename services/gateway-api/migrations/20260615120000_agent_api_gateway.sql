-- Batch 73: Agent API Gateway & Routing
-- API routes, gateway policies, request transformation, load balancing, and traffic management

CREATE TABLE IF NOT EXISTS api_routes (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  path            TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  target_url      TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  auth_required   BOOLEAN NOT NULL DEFAULT false,
  rate_limit      INTEGER DEFAULT 0,
  timeout_ms      INTEGER NOT NULL DEFAULT 30000,
  priority        INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gateway_policies (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  policy_type     TEXT NOT NULL CHECK (policy_type IN ('cors','auth','transform','throttle','circuit_breaker','retry','cache')),
  config          JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  priority        INTEGER NOT NULL DEFAULT 0,
  applied_routes  JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_transforms (
  id              TEXT PRIMARY KEY,
  route_id        TEXT NOT NULL REFERENCES api_routes(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('request','response')),
  transform_type  TEXT NOT NULL CHECK (transform_type IN ('header_add','header_remove','body_rewrite','url_rewrite','query_add','status_override')),
  config          JSONB NOT NULL DEFAULT '{}',
  execution_order INTEGER NOT NULL DEFAULT 0,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS load_balancer_pools (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  algorithm       TEXT NOT NULL DEFAULT 'round_robin' CHECK (algorithm IN ('round_robin','least_connections','weighted','ip_hash','random')),
  health_check    JSONB DEFAULT '{}',
  targets         JSONB NOT NULL DEFAULT '[]',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traffic_logs (
  id              TEXT PRIMARY KEY,
  route_id        TEXT NOT NULL REFERENCES api_routes(id) ON DELETE CASCADE,
  method          TEXT NOT NULL,
  path            TEXT NOT NULL,
  status_code     INTEGER,
  latency_ms      INTEGER,
  request_size    BIGINT DEFAULT 0,
  response_size   BIGINT DEFAULT 0,
  client_ip       TEXT,
  user_agent      TEXT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_routes_agent ON api_routes(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_routes_path ON api_routes(path);
CREATE INDEX IF NOT EXISTS idx_api_routes_method ON api_routes(method);
CREATE INDEX IF NOT EXISTS idx_api_routes_enabled ON api_routes(enabled);
CREATE INDEX IF NOT EXISTS idx_gateway_policies_type ON gateway_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_gateway_policies_enabled ON gateway_policies(enabled);
CREATE INDEX IF NOT EXISTS idx_gateway_policies_priority ON gateway_policies(priority);
CREATE INDEX IF NOT EXISTS idx_request_transforms_route ON request_transforms(route_id);
CREATE INDEX IF NOT EXISTS idx_request_transforms_dir ON request_transforms(direction);
CREATE INDEX IF NOT EXISTS idx_request_transforms_type ON request_transforms(transform_type);
CREATE INDEX IF NOT EXISTS idx_request_transforms_order ON request_transforms(execution_order);
CREATE INDEX IF NOT EXISTS idx_lb_pools_algorithm ON load_balancer_pools(algorithm);
CREATE INDEX IF NOT EXISTS idx_lb_pools_enabled ON load_balancer_pools(enabled);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_route ON traffic_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_status ON traffic_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_latency ON traffic_logs(latency_ms);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_created ON traffic_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_client ON traffic_logs(client_ip);
CREATE INDEX IF NOT EXISTS idx_api_routes_priority ON api_routes(priority);
