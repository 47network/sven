-- Batch 300: Compliance Auditor
CREATE TABLE IF NOT EXISTS agent_compliance_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  framework TEXT NOT NULL DEFAULT 'soc2', schedule_cron TEXT DEFAULT '0 6 * * 1',
  auto_remediate BOOLEAN DEFAULT false, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_compliance_configs(id),
  control_id TEXT NOT NULL, control_name TEXT NOT NULL, category TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending', compliant BOOLEAN, evidence JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_compliance_configs(id),
  framework TEXT NOT NULL, period_start TIMESTAMPTZ, period_end TIMESTAMPTZ,
  total_controls INTEGER DEFAULT 0, passing INTEGER DEFAULT 0, failing INTEGER DEFAULT 0,
  score DOUBLE PRECISION DEFAULT 0, generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_compliance_configs_agent ON agent_compliance_configs(agent_id);
CREATE INDEX idx_compliance_checks_config ON agent_compliance_checks(config_id);
CREATE INDEX idx_compliance_reports_config ON agent_compliance_reports(config_id);
