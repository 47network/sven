-- Batch 110 — Agent Compliance Scanner
-- Policy rules, scan results, remediation tracking

CREATE TABLE IF NOT EXISTS agent_compliance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  framework VARCHAR(100) NOT NULL DEFAULT 'soc2',
  category VARCHAR(100) NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'medium',
  rule_expression TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_compliance_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_id UUID NOT NULL REFERENCES agent_compliance_policies(id) ON DELETE CASCADE,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'non_compliant',
  evidence JSONB,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_compliance_remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_result_id UUID NOT NULL REFERENCES agent_compliance_scan_results(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  assigned_to VARCHAR(255),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_agent ON agent_compliance_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_framework ON agent_compliance_policies(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_results_policy ON agent_compliance_scan_results(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_results_agent ON agent_compliance_scan_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_compliance_results_status ON agent_compliance_scan_results(status);
CREATE INDEX IF NOT EXISTS idx_compliance_remediations_result ON agent_compliance_remediations(scan_result_id);
