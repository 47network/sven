-- Batch 310: Orchestrator vertical
CREATE TABLE IF NOT EXISTS agent_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  platform TEXT NOT NULL DEFAULT 'kubernetes' CHECK (platform IN ('kubernetes','docker_swarm','nomad','compose')),
  cluster_name TEXT NOT NULL DEFAULT 'sven-cluster',
  namespace TEXT NOT NULL DEFAULT 'default',
  auto_scale BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_orchestrator_configs(id),
  deployment_name TEXT NOT NULL,
  replica_count INTEGER NOT NULL DEFAULT 1,
  desired_replicas INTEGER NOT NULL DEFAULT 1,
  strategy TEXT NOT NULL DEFAULT 'rolling' CHECK (strategy IN ('rolling','recreate','blue_green','canary')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','deploying','running','degraded','failed')),
  image_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_orchestrator_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES agent_deployments(id),
  event_type TEXT NOT NULL,
  message TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orchestrator_configs_agent ON agent_orchestrator_configs(agent_id);
CREATE INDEX idx_deployments_config ON agent_deployments(config_id);
CREATE INDEX idx_deployments_status ON agent_deployments(status);
CREATE INDEX idx_orchestrator_events_deploy ON agent_orchestrator_events(deployment_id);
