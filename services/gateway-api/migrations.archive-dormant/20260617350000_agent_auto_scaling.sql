-- Batch 98: Agent Auto-Scaling
CREATE TABLE IF NOT EXISTS agent_scaling_policies (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'compute',
  min_instances INTEGER NOT NULL DEFAULT 1,
  max_instances INTEGER NOT NULL DEFAULT 10,
  target_metric TEXT NOT NULL DEFAULT 'cpu_utilization',
  target_value REAL NOT NULL DEFAULT 70.0,
  scale_up_threshold REAL NOT NULL DEFAULT 80.0,
  scale_down_threshold REAL NOT NULL DEFAULT 30.0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_scaling_events (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES agent_scaling_policies(id),
  direction TEXT NOT NULL DEFAULT 'up',
  from_count INTEGER NOT NULL,
  to_count INTEGER NOT NULL,
  trigger_metric TEXT NOT NULL,
  trigger_value REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_scaling_metrics (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES agent_scaling_policies(id),
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  instance_count INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scaling_policies_agent ON agent_scaling_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_scaling_events_policy ON agent_scaling_events(policy_id);
CREATE INDEX IF NOT EXISTS idx_scaling_metrics_policy ON agent_scaling_metrics(policy_id);
CREATE INDEX IF NOT EXISTS idx_scaling_metrics_recorded ON agent_scaling_metrics(recorded_at);
