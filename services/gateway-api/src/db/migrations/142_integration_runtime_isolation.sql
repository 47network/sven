BEGIN;

CREATE TABLE IF NOT EXISTS integration_runtime_instances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  runtime_mode TEXT NOT NULL DEFAULT 'container' CHECK (runtime_mode IN ('container', 'local_worker')),
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped', 'deploying', 'running', 'error')),
  image_ref TEXT,
  storage_path TEXT,
  network_scope TEXT,
  deployment_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  last_deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_runtime_instances_org
  ON integration_runtime_instances (organization_id, integration_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS integration_runtime_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (organization_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_runtime_configs_org
  ON integration_runtime_configs (organization_id, integration_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS integration_runtime_secret_refs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  secret_ref TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (organization_id, integration_type, secret_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_runtime_secret_refs_org
  ON integration_runtime_secret_refs (organization_id, integration_type, updated_at DESC);

COMMIT;
