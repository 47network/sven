-- Batch 339: Rollback Manager
CREATE TABLE IF NOT EXISTS agent_rollback_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  max_snapshots INTEGER DEFAULT 50,
  auto_rollback_on_failure BOOLEAN DEFAULT true,
  retention_days INTEGER DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_deployment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_rollback_manager_configs(id),
  deployment_id TEXT NOT NULL,
  version TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_rollback_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES agent_deployment_snapshots(id),
  reason TEXT,
  initiated_by TEXT DEFAULT 'system',
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_deploy_snapshots_config ON agent_deployment_snapshots(config_id);
CREATE INDEX idx_rollback_ops_snapshot ON agent_rollback_operations(snapshot_id);
