-- Batch 226: Compliance Checker
CREATE TABLE IF NOT EXISTS agent_compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  framework_name TEXT NOT NULL,
  framework_type TEXT NOT NULL CHECK (framework_type IN ('gdpr','hipaa','soc2','iso27001','pci_dss','nist','custom')),
  version TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','reviewing','expired')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES agent_compliance_frameworks(id),
  check_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed','skipped','not_applicable')),
  evidence JSONB NOT NULL DEFAULT '{}',
  findings TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES agent_compliance_frameworks(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('summary','detailed','executive','audit_trail')),
  pass_rate NUMERIC(5,2),
  total_checks INT NOT NULL DEFAULT 0,
  passed_checks INT NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compliance_frameworks_agent ON agent_compliance_frameworks(agent_id);
CREATE INDEX idx_compliance_checks_framework ON agent_compliance_checks(framework_id);
CREATE INDEX idx_compliance_reports_framework ON agent_compliance_reports(framework_id);
