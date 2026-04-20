-- Batch 108 — Agent Edge Computing
-- Edge node management, function deployment, latency tracking

CREATE TABLE IF NOT EXISTS agent_edge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  node_name VARCHAR(255) NOT NULL,
  region VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL DEFAULT 'cloudflare',
  status VARCHAR(30) NOT NULL DEFAULT 'provisioning',
  cpu_cores INT NOT NULL DEFAULT 2,
  memory_mb INT NOT NULL DEFAULT 512,
  storage_gb INT NOT NULL DEFAULT 10,
  ip_address VARCHAR(45),
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_edge_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  node_id UUID NOT NULL REFERENCES agent_edge_nodes(id) ON DELETE CASCADE,
  function_name VARCHAR(255) NOT NULL,
  runtime VARCHAR(50) NOT NULL DEFAULT 'javascript',
  version INT NOT NULL DEFAULT 1,
  bundle_size_bytes BIGINT NOT NULL DEFAULT 0,
  memory_limit_mb INT NOT NULL DEFAULT 128,
  timeout_ms INT NOT NULL DEFAULT 30000,
  invocations_total BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'deploying',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_edge_latency_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  node_id UUID NOT NULL REFERENCES agent_edge_nodes(id) ON DELETE CASCADE,
  function_id UUID REFERENCES agent_edge_functions(id) ON DELETE SET NULL,
  origin_region VARCHAR(100) NOT NULL,
  p50_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  p95_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  p99_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  sample_count INT NOT NULL DEFAULT 0,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_nodes_agent ON agent_edge_nodes(agent_id);
CREATE INDEX IF NOT EXISTS idx_edge_nodes_region ON agent_edge_nodes(region);
CREATE INDEX IF NOT EXISTS idx_edge_functions_node ON agent_edge_functions(node_id);
CREATE INDEX IF NOT EXISTS idx_edge_functions_agent ON agent_edge_functions(agent_id);
CREATE INDEX IF NOT EXISTS idx_edge_latency_node ON agent_edge_latency_metrics(node_id);
CREATE INDEX IF NOT EXISTS idx_edge_latency_measured ON agent_edge_latency_metrics(measured_at);
