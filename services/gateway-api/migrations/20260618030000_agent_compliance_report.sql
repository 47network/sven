-- Batch 166: Agent Compliance Report
-- Generate compliance reports for auditors, regulators, and internal governance

CREATE TABLE IF NOT EXISTS agent_compliance_frameworks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  framework_name  TEXT NOT NULL,
  framework_type  TEXT NOT NULL CHECK (framework_type IN ('gdpr','soc2','iso27001','hipaa','pci_dss','nist','custom')),
  version         TEXT NOT NULL DEFAULT '1.0',
  controls        JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_compliance_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID NOT NULL REFERENCES agent_compliance_frameworks(id),
  assessment_name TEXT NOT NULL,
  assessor        TEXT NOT NULL DEFAULT 'automated',
  overall_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  pass_count      INT NOT NULL DEFAULT 0,
  fail_count      INT NOT NULL DEFAULT 0,
  na_count        INT NOT NULL DEFAULT 0,
  findings        JSONB NOT NULL DEFAULT '[]',
  evidence_urls   TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','reviewed','accepted')),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_compliance_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES agent_compliance_assessments(id),
  control_id      TEXT NOT NULL,
  finding_type    TEXT NOT NULL CHECK (finding_type IN ('pass','fail','warning','not_applicable','exception')),
  severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','info')),
  description     TEXT NOT NULL,
  remediation     TEXT,
  due_date        TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_frameworks_tenant ON agent_compliance_frameworks(tenant_id);
CREATE INDEX idx_compliance_assessments_framework ON agent_compliance_assessments(framework_id);
CREATE INDEX idx_compliance_findings_assessment ON agent_compliance_findings(assessment_id);
