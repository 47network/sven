-- Batch 298: Vulnerability Scanner
CREATE TABLE IF NOT EXISTS agent_vuln_scan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'dependency', schedule_cron TEXT DEFAULT '0 3 * * 1',
  severity_threshold TEXT NOT NULL DEFAULT 'high', auto_fix BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_vuln_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_vuln_scan_configs(id),
  scan_type TEXT NOT NULL, target TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'running',
  total_found INTEGER DEFAULT 0, critical INTEGER DEFAULT 0, high INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), scan_id UUID NOT NULL REFERENCES agent_vuln_scans(id),
  cve_id TEXT, severity TEXT NOT NULL, package_name TEXT, affected_version TEXT,
  fixed_version TEXT, description TEXT, remediation TEXT, patched BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vuln_scan_configs_agent ON agent_vuln_scan_configs(agent_id);
CREATE INDEX idx_vuln_scans_config ON agent_vuln_scans(config_id);
CREATE INDEX idx_vulnerabilities_scan ON agent_vulnerabilities(scan_id);
