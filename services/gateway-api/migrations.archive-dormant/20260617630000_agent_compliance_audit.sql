CREATE TABLE IF NOT EXISTS agent_compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  framework_type TEXT NOT NULL CHECK (framework_type IN ('gdpr','soc2','hipaa','pci_dss','iso27001','custom')),
  version TEXT NOT NULL DEFAULT '1.0',
  control_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES agent_compliance_frameworks(id),
  control_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'not_assessed' CHECK (status IN ('not_assessed','compliant','non_compliant','partial','not_applicable')),
  evidence JSONB DEFAULT '[]',
  last_assessed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES agent_compliance_frameworks(id),
  auditor_agent_id UUID,
  report_type TEXT NOT NULL CHECK (report_type IN ('full','delta','control','executive')),
  compliance_score NUMERIC(5,2),
  findings_count INTEGER NOT NULL DEFAULT 0,
  critical_findings INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  report_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_frameworks_agent ON agent_compliance_frameworks(agent_id);
CREATE INDEX idx_frameworks_type ON agent_compliance_frameworks(framework_type);
CREATE INDEX idx_controls_framework ON agent_compliance_controls(framework_id);
CREATE INDEX idx_controls_status ON agent_compliance_controls(status);
CREATE INDEX idx_audits_framework ON agent_audit_reports(framework_id);
CREATE INDEX idx_audits_score ON agent_audit_reports(compliance_score);
