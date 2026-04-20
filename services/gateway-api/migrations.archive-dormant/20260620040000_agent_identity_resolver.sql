CREATE TABLE IF NOT EXISTS agent_identity_resolver_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resolution_strategy TEXT NOT NULL DEFAULT 'federated',
  identity_providers JSONB NOT NULL DEFAULT '[]',
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  fallback_enabled BOOLEAN NOT NULL DEFAULT true,
  audit_log_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_identity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_identity_resolver_configs(id),
  agent_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  identity_type TEXT NOT NULL DEFAULT 'user',
  display_name TEXT,
  email TEXT,
  attributes JSONB NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_identity_resolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES agent_identity_records(id),
  resolution_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  query_input JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_identity_records_agent ON agent_identity_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_identity_records_external ON agent_identity_records(external_id);
CREATE INDEX IF NOT EXISTS idx_identity_resolution_record ON agent_identity_resolution_logs(record_id);
