-- Batch 231: Security Scanner
-- Scans agent infrastructure and code for vulnerabilities

CREATE TABLE IF NOT EXISTS agent_scan_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  profile_name VARCHAR(255) NOT NULL,
  scan_type VARCHAR(64) NOT NULL CHECK (scan_type IN ('vulnerability', 'dependency', 'configuration', 'code', 'network', 'container')),
  targets JSONB NOT NULL DEFAULT '[]',
  schedule VARCHAR(64),
  severity_threshold VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (severity_threshold IN ('critical', 'high', 'medium', 'low', 'info')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES agent_scan_profiles(id),
  agent_id UUID NOT NULL,
  findings_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '[]',
  duration_ms INTEGER,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_scan_remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES agent_scan_results(id),
  finding_index INTEGER NOT NULL,
  remediation_type VARCHAR(64) NOT NULL CHECK (remediation_type IN ('patch', 'config_change', 'upgrade', 'workaround', 'accept_risk')),
  description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_profiles_agent ON agent_scan_profiles(agent_id);
CREATE INDEX idx_scan_results_profile ON agent_scan_results(profile_id);
CREATE INDEX idx_scan_results_agent ON agent_scan_results(agent_id);
CREATE INDEX idx_scan_remediations_result ON agent_scan_remediations(result_id);
