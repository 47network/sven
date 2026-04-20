-- Batch 248: Network Auditor
CREATE TABLE IF NOT EXISTS agent_audit_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_name TEXT NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('compliance', 'vulnerability', 'configuration', 'performance')),
  target_scope JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  findings_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES agent_audit_scans(id),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_resource TEXT,
  remediation TEXT,
  compliant BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES agent_audit_scans(id),
  report_format TEXT NOT NULL CHECK (report_format IN ('json', 'pdf', 'html', 'csv')),
  summary TEXT,
  overall_score NUMERIC(5,2),
  storage_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_scans_agent ON agent_audit_scans(agent_id);
CREATE INDEX idx_audit_findings_scan ON agent_audit_findings(scan_id);
CREATE INDEX idx_audit_findings_severity ON agent_audit_findings(severity);
