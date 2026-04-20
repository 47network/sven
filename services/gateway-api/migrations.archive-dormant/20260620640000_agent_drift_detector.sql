-- Batch 427: Drift Detector
CREATE TABLE IF NOT EXISTS agent_drift_detector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_interval_hours INTEGER NOT NULL DEFAULT 4,
  drift_tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  auto_remediate BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_drift_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_drift_detector_configs(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  expected_state JSONB NOT NULL,
  current_state JSONB,
  drift_detected BOOLEAN NOT NULL DEFAULT false,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES agent_drift_baselines(id),
  drift_type TEXT NOT NULL CHECK (drift_type IN ('added','removed','modified','permissions','config','state')),
  field_path TEXT NOT NULL,
  expected_value TEXT,
  actual_value TEXT,
  remediated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_drift_detector_configs_agent ON agent_drift_detector_configs(agent_id);
CREATE INDEX idx_agent_drift_baselines_config ON agent_drift_baselines(config_id);
CREATE INDEX idx_agent_drift_events_baseline ON agent_drift_events(baseline_id);
