-- Batch 278: Cloud Provisioner
CREATE TABLE IF NOT EXISTS agent_cloud_prov_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'proxmox',
  region TEXT,
  credentials_ref TEXT,
  resource_quotas JSONB DEFAULT '{}',
  auto_scale BOOLEAN DEFAULT false,
  cost_limit_cents INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_cloud_prov_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cloud_prov_configs(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  name TEXT NOT NULL,
  specs JSONB DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'provisioning',
  cost_per_hour_cents INTEGER DEFAULT 0,
  provisioned_at TIMESTAMPTZ DEFAULT NOW(),
  destroyed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_cloud_prov_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES agent_cloud_prov_resources(id),
  event_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cloud_prov_configs_agent ON agent_cloud_prov_configs(agent_id);
CREATE INDEX idx_cloud_prov_resources_config ON agent_cloud_prov_resources(config_id);
CREATE INDEX idx_cloud_prov_events_resource ON agent_cloud_prov_events(resource_id);
