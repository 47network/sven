-- Batch 360: Tenant Provisioner
-- Provisions isolated environments/tenants for multi-tenant agent workloads

CREATE TABLE IF NOT EXISTS agent_tenant_provisioner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  isolation_level VARCHAR(32) NOT NULL DEFAULT 'namespace',
  provisioning_strategy VARCHAR(32) NOT NULL DEFAULT 'on_demand',
  resource_quota_cpu NUMERIC(10,2) NOT NULL DEFAULT 1.0,
  resource_quota_memory_mb INTEGER NOT NULL DEFAULT 512,
  max_tenants INTEGER NOT NULL DEFAULT 100,
  auto_cleanup BOOLEAN NOT NULL DEFAULT true,
  cleanup_after_days INTEGER NOT NULL DEFAULT 90,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_tenant_provisioner_configs(id),
  agent_id UUID NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_slug VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'provisioning',
  isolation_level VARCHAR(32) NOT NULL DEFAULT 'namespace',
  resource_usage JSONB NOT NULL DEFAULT '{}',
  connection_string TEXT,
  provisioned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tenant_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES agent_tenants(id),
  operation_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  details JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_provisioner_configs_agent ON agent_tenant_provisioner_configs(agent_id);
CREATE INDEX idx_tenants_config ON agent_tenants(config_id);
CREATE INDEX idx_tenants_agent ON agent_tenants(agent_id);
CREATE INDEX idx_tenants_slug ON agent_tenants(tenant_slug);
CREATE INDEX idx_tenant_operations_tenant ON agent_tenant_operations(tenant_id);
