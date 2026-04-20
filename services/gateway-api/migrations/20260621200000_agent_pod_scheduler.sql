CREATE TABLE IF NOT EXISTS agent_pod_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  scheduling_strategy TEXT NOT NULL DEFAULT 'balanced',
  priority_class TEXT NOT NULL DEFAULT 'normal',
  node_affinity JSONB NOT NULL DEFAULT '{}',
  resource_requests JSONB NOT NULL DEFAULT '{}',
  preemption_allowed BOOLEAN NOT NULL DEFAULT false,
  max_replicas INTEGER NOT NULL DEFAULT 10,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pod_scheduler_agent ON agent_pod_scheduler_configs(agent_id);
CREATE INDEX idx_pod_scheduler_enabled ON agent_pod_scheduler_configs(enabled);
