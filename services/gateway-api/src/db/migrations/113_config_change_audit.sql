-- Migration 113: Config change audit trail
-- Tracks organization-scoped config changes from admin settings endpoints.

CREATE TABLE IF NOT EXISTS config_change_audit (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT,
  changed_by_user_id TEXT,
  source_ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_config_change_audit_org_changed_at
  ON config_change_audit(organization_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_config_change_audit_key_changed_at
  ON config_change_audit(key, changed_at DESC);
