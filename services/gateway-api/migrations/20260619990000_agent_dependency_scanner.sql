-- Batch 362: Dependency Scanner
-- Scans and audits agent dependencies for vulnerabilities and updates

CREATE TABLE IF NOT EXISTS agent_dependency_scanner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_schedule VARCHAR(64) NOT NULL DEFAULT '0 0 * * *',
  severity_threshold VARCHAR(16) NOT NULL DEFAULT 'medium',
  auto_update_patch BOOLEAN NOT NULL DEFAULT false,
  package_managers TEXT[] NOT NULL DEFAULT '{npm}',
  ignore_patterns TEXT[] NOT NULL DEFAULT '{}',
  notification_channels TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dependency_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_dependency_scanner_configs(id),
  agent_id UUID NOT NULL,
  scan_type VARCHAR(32) NOT NULL DEFAULT 'full',
  total_dependencies INTEGER NOT NULL DEFAULT 0,
  vulnerable_count INTEGER NOT NULL DEFAULT 0,
  outdated_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'scanning',
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_vulnerability_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES agent_dependency_scans(id),
  package_name VARCHAR(255) NOT NULL,
  current_version VARCHAR(64) NOT NULL,
  patched_version VARCHAR(64),
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  cve_id VARCHAR(32),
  description TEXT,
  fix_available BOOLEAN NOT NULL DEFAULT false,
  auto_fixable BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dependency_scanner_configs_agent ON agent_dependency_scanner_configs(agent_id);
CREATE INDEX idx_dependency_scans_config ON agent_dependency_scans(config_id);
CREATE INDEX idx_dependency_scans_agent ON agent_dependency_scans(agent_id);
CREATE INDEX idx_vulnerability_findings_scan ON agent_vulnerability_findings(scan_id);
CREATE INDEX idx_vulnerability_findings_severity ON agent_vulnerability_findings(severity);
