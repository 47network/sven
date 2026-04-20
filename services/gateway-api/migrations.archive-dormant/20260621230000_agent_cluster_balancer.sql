CREATE TABLE IF NOT EXISTS agent_cluster_balancer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  algorithm TEXT NOT NULL DEFAULT 'round_robin',
  health_check_interval INTEGER NOT NULL DEFAULT 30,
  sticky_sessions BOOLEAN NOT NULL DEFAULT false,
  drain_timeout_seconds INTEGER NOT NULL DEFAULT 60,
  max_connections_per_node INTEGER NOT NULL DEFAULT 1000,
  circuit_breaker_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cluster_balancer_agent ON agent_cluster_balancer_configs(agent_id);
CREATE INDEX idx_cluster_balancer_enabled ON agent_cluster_balancer_configs(enabled);
