-- Batch 342: Deployment Gate
CREATE TABLE IF NOT EXISTS agent_deployment_gate_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  require_all_checks BOOLEAN DEFAULT true,
  auto_approve_timeout INTEGER DEFAULT 3600,
  notification_channel TEXT DEFAULT 'nats',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_gate_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_deployment_gate_configs(id),
  check_name TEXT NOT NULL,
  check_type TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  parameters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_gate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_deployment_gate_configs(id),
  deployment_id TEXT NOT NULL,
  check_results JSONB DEFAULT '[]',
  decision TEXT DEFAULT 'pending',
  decided_by TEXT,
  reason TEXT,
  decided_at TIMESTAMPTZ
);

CREATE INDEX idx_gate_checks_config ON agent_gate_checks(config_id);
CREATE INDEX idx_gate_decisions_config ON agent_gate_decisions(config_id);
