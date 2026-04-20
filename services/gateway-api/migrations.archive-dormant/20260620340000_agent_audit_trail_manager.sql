-- Batch 397: Audit Trail Manager
CREATE TABLE IF NOT EXISTS agent_audit_trail_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 365,
  tamper_detection BOOLEAN NOT NULL DEFAULT true,
  hash_algorithm TEXT NOT NULL DEFAULT 'sha-256',
  export_format TEXT NOT NULL DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'syslog', 'cef')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_audit_trail_manager_configs(id),
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  chain_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_audit_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_audit_trail_manager_configs(id),
  format TEXT NOT NULL,
  date_from TIMESTAMPTZ NOT NULL,
  date_to TIMESTAMPTZ NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entries_config ON agent_audit_entries(config_id);
CREATE INDEX idx_audit_entries_actor ON agent_audit_entries(actor_id);
CREATE INDEX idx_audit_entries_resource ON agent_audit_entries(resource_type, resource_id);
CREATE INDEX idx_audit_exports_config ON agent_audit_exports(config_id);
