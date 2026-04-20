-- Batch 249: Connection Pooler
CREATE TABLE IF NOT EXISTS agent_connection_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pool_name TEXT NOT NULL,
  backend_type TEXT NOT NULL CHECK (backend_type IN ('postgresql', 'mysql', 'redis', 'http', 'grpc')),
  connection_string_ref TEXT NOT NULL,
  min_connections INTEGER DEFAULT 2,
  max_connections INTEGER DEFAULT 20,
  idle_timeout_seconds INTEGER DEFAULT 300,
  max_lifetime_seconds INTEGER DEFAULT 3600,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draining', 'stopped', 'error')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_pool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES agent_connection_pools(id),
  connection_state TEXT NOT NULL CHECK (connection_state IN ('idle', 'active', 'closing', 'closed')),
  client_id TEXT,
  backend_pid INTEGER,
  queries_served INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES agent_connection_pools(id),
  measured_at TIMESTAMPTZ DEFAULT now(),
  active_connections INTEGER DEFAULT 0,
  idle_connections INTEGER DEFAULT 0,
  waiting_clients INTEGER DEFAULT 0,
  total_queries BIGINT DEFAULT 0,
  avg_query_time_ms NUMERIC(10,2),
  pool_hit_rate NUMERIC(5,2),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_conn_pools_agent ON agent_connection_pools(agent_id);
CREATE INDEX idx_pool_connections_pool ON agent_pool_connections(pool_id);
CREATE INDEX idx_pool_metrics_pool ON agent_pool_metrics(pool_id);
