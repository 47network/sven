-- Batch 285: Deploy Manager
CREATE TABLE IF NOT EXISTS agent_deploy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'rolling',
  target_env TEXT NOT NULL DEFAULT 'production',
  health_check_url TEXT,
  rollback_on_failure BOOLEAN DEFAULT true,
  approval_required BOOLEAN DEFAULT false,
  max_instances INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_deploy_configs(id),
  version TEXT NOT NULL,
  image_ref TEXT,
  target_env TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'preparing',
  instances_total INTEGER DEFAULT 1,
  instances_ready INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_deploy_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES agent_deployments(id),
  check_type TEXT NOT NULL DEFAULT 'http',
  endpoint TEXT,
  status_code INTEGER,
  response_ms INTEGER,
  healthy BOOLEAN DEFAULT false,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_deploy_configs_agent ON agent_deploy_configs(agent_id);
CREATE INDEX idx_deployments_config ON agent_deployments(config_id);
CREATE INDEX idx_deploy_health_deployment ON agent_deploy_health_checks(deployment_id);
