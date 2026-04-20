-- Batch 297: Pool Manager
CREATE TABLE IF NOT EXISTS agent_pool_mgr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pool_mode TEXT NOT NULL DEFAULT 'transaction',
  min_connections INTEGER DEFAULT 5,
  max_connections INTEGER DEFAULT 100,
  idle_timeout_seconds INTEGER DEFAULT 300,
  max_lifetime_seconds INTEGER DEFAULT 3600,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_pool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_pool_mgr_configs(id),
  client_addr TEXT,
  server_addr TEXT,
  database_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  queries_executed BIGINT DEFAULT 0,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_pool_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_pool_mgr_configs(id),
  active_connections INTEGER DEFAULT 0,
  idle_connections INTEGER DEFAULT 0,
  waiting_clients INTEGER DEFAULT 0,
  total_queries BIGINT DEFAULT 0,
  avg_query_ms DOUBLE PRECISION DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pool_mgr_configs_agent ON agent_pool_mgr_configs(agent_id);
CREATE INDEX idx_pool_connections_config ON agent_pool_connections(config_id);
CREATE INDEX idx_pool_stats_config ON agent_pool_stats(config_id);
