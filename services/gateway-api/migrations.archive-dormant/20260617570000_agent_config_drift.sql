-- Batch 120 — Config Drift Detection
-- Detects and tracks configuration drift across agent infrastructure

CREATE TABLE IF NOT EXISTS agent_config_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('vm','container','service','database','network','dns')),
  resource_id TEXT NOT NULL,
  name TEXT NOT NULL,
  baseline_config JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS agent_config_drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES agent_config_baselines(id) ON DELETE CASCADE,
  drift_type TEXT NOT NULL CHECK (drift_type IN ('added','removed','modified','type_changed')),
  config_path TEXT NOT NULL,
  expected_value TEXT,
  actual_value TEXT,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical','warning','info')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  auto_remediated BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS agent_config_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'full' CHECK (scan_type IN ('full','incremental','targeted')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  resources_scanned INT NOT NULL DEFAULT 0,
  drifts_found INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_config_baselines_agent ON agent_config_baselines(agent_id);
CREATE INDEX idx_config_baselines_resource ON agent_config_baselines(resource_type, resource_id);
CREATE INDEX idx_config_drift_baseline ON agent_config_drift_events(baseline_id);
CREATE INDEX idx_config_drift_severity ON agent_config_drift_events(severity);
CREATE INDEX idx_config_drift_unresolved ON agent_config_drift_events(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_config_scan_agent ON agent_config_scan_jobs(agent_id);
