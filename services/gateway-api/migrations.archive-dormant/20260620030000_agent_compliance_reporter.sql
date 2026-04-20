CREATE TABLE IF NOT EXISTS agent_compliance_reporter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  frameworks JSONB NOT NULL DEFAULT '["soc2", "gdpr"]',
  report_frequency TEXT NOT NULL DEFAULT 'monthly',
  auto_evidence_collection BOOLEAN NOT NULL DEFAULT true,
  notification_recipients JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_compliance_reporter_configs(id),
  agent_id UUID NOT NULL,
  framework TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'periodic',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  overall_score NUMERIC(5,2),
  total_controls INTEGER NOT NULL DEFAULT 0,
  passing_controls INTEGER NOT NULL DEFAULT 0,
  failing_controls INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generating',
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_compliance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES agent_compliance_reports(id),
  control_id TEXT NOT NULL,
  control_name TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'collected',
  verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_agent ON agent_compliance_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework ON agent_compliance_reports(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_report ON agent_compliance_evidence(report_id);
