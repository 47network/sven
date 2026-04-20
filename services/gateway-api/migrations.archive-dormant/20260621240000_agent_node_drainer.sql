CREATE TABLE IF NOT EXISTS agent_node_drainer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  grace_period_seconds INTEGER NOT NULL DEFAULT 120,
  force_drain BOOLEAN NOT NULL DEFAULT false,
  cordon_before_drain BOOLEAN NOT NULL DEFAULT true,
  skip_daemonsets BOOLEAN NOT NULL DEFAULT true,
  pod_eviction_timeout INTEGER NOT NULL DEFAULT 300,
  notification_webhook TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_node_drainer_agent ON agent_node_drainer_configs(agent_id);
CREATE INDEX idx_node_drainer_enabled ON agent_node_drainer_configs(enabled);
