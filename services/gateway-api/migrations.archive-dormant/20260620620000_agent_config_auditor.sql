-- Batch 425: Config Auditor
CREATE TABLE IF NOT EXISTS agent_config_auditor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_interval_hours INTEGER NOT NULL DEFAULT 6,
  compliance_frameworks TEXT[] DEFAULT '{}',
  severity_threshold TEXT NOT NULL DEFAULT 'medium' CHECK (severity_threshold IN ('low','medium','high','critical')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_config_auditor_configs(id),
  service_name TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  config_data JSONB NOT NULL,
  baseline BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_config_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES agent_config_snapshots(id),
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description TEXT NOT NULL,
  remediation TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_config_auditor_configs_agent ON agent_config_auditor_configs(agent_id);
CREATE INDEX idx_agent_config_snapshots_config ON agent_config_snapshots(config_id);
CREATE INDEX idx_agent_config_violations_snapshot ON agent_config_violations(snapshot_id);
