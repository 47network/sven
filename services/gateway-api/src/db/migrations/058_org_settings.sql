BEGIN;

CREATE TABLE IF NOT EXISTS organization_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_org_settings_org_key ON organization_settings (organization_id, key);

COMMIT;
