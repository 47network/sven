-- D2 Phase 3: tenant storage mapping for schema-per-tenant provisioning.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_storage_mapping (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  storage_mode TEXT NOT NULL DEFAULT 'shared_schema'
    CHECK (storage_mode IN ('shared_schema', 'dedicated_schema', 'dedicated_database')),
  schema_name TEXT,
  database_name TEXT,
  connection_ref TEXT,
  provisioned BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_storage_mode
  ON tenant_storage_mapping (storage_mode, updated_at DESC);
