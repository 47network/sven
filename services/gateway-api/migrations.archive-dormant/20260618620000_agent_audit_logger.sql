-- Batch 225: Audit Logger
CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('debug','info','warning','error','critical')),
  details JSONB NOT NULL DEFAULT '{}',
  source_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_audit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  resource_types TEXT[] NOT NULL DEFAULT '{}',
  actions TEXT[] NOT NULL DEFAULT '{}',
  retention_days INT NOT NULL DEFAULT 90,
  alert_on TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_audit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_audit_policies(id),
  log_id UUID NOT NULL REFERENCES agent_audit_logs(id),
  alert_type TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_agent ON agent_audit_logs(agent_id);
CREATE INDEX idx_audit_logs_action ON agent_audit_logs(action);
CREATE INDEX idx_audit_policies_agent ON agent_audit_policies(agent_id);
CREATE INDEX idx_audit_alerts_policy ON agent_audit_alerts(policy_id);
