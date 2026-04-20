-- Batch 55 — Agent Compliance & Audit
-- Regulatory compliance tracking, audit trails, policy enforcement,
-- compliance reporting, and risk assessments for autonomous agents.

-- 1. Compliance policies
CREATE TABLE IF NOT EXISTS compliance_policies (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  policy_type    TEXT NOT NULL CHECK (policy_type IN ('regulatory','operational','security','financial','ethical')),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','retired','under_review')),
  rules          JSONB NOT NULL DEFAULT '[]',
  severity       TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','informational')),
  effective_from TIMESTAMPTZ,
  effective_to   TIMESTAMPTZ,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Audit trail
CREATE TABLE IF NOT EXISTS audit_trail (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  action_type     TEXT NOT NULL CHECK (action_type IN ('create','read','update','delete','execute','approve','reject','escalate')),
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  details         JSONB NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  session_id      TEXT,
  outcome         TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','failure','partial','denied')),
  risk_level      TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('critical','high','medium','low','none')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Compliance checks
CREATE TABLE IF NOT EXISTS compliance_checks (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT NOT NULL REFERENCES compliance_policies(id),
  agent_id        TEXT,
  check_type      TEXT NOT NULL CHECK (check_type IN ('automated','manual','scheduled','triggered','random')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','passed','failed','warning','skipped')),
  findings        JSONB NOT NULL DEFAULT '[]',
  score           NUMERIC(5,2),
  checked_at      TIMESTAMPTZ,
  next_check_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Risk assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('initial','periodic','incident','change','compliance')),
  risk_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_level      TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('critical','high','medium','low','negligible')),
  factors         JSONB NOT NULL DEFAULT '[]',
  mitigations     JSONB NOT NULL DEFAULT '[]',
  assessed_by     TEXT,
  valid_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id              TEXT PRIMARY KEY,
  report_type     TEXT NOT NULL CHECK (report_type IN ('summary','detailed','incident','regulatory','executive')),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generating','ready','delivered','archived')),
  summary         JSONB NOT NULL DEFAULT '{}',
  findings_count  INTEGER NOT NULL DEFAULT 0,
  pass_rate       NUMERIC(5,2),
  generated_by    TEXT,
  delivered_to    JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (17)
CREATE INDEX IF NOT EXISTS idx_compliance_policies_type ON compliance_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_status ON compliance_policies(status);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_severity ON compliance_policies(severity);
CREATE INDEX IF NOT EXISTS idx_audit_trail_agent ON audit_trail(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_outcome ON audit_trail(outcome);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_policy ON compliance_checks(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_agent ON compliance_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON compliance_checks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_next ON compliance_checks(next_check_at);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_agent ON risk_assessments(agent_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_type ON risk_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level ON risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);
