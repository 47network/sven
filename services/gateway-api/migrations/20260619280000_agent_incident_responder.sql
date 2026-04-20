-- Batch 291: Incident Responder
CREATE TABLE IF NOT EXISTS agent_incident_resp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  auto_remediate BOOLEAN DEFAULT false,
  escalation_policy JSONB DEFAULT '[]',
  runbook_dir TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_incident_resp_configs(id),
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT,
  root_cause TEXT,
  resolution TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_incident_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES agent_incidents(id),
  action_type TEXT NOT NULL,
  description TEXT,
  automated BOOLEAN DEFAULT false,
  result JSONB DEFAULT '{}',
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_incident_resp_configs_agent ON agent_incident_resp_configs(agent_id);
CREATE INDEX idx_incidents_config ON agent_incidents(config_id);
CREATE INDEX idx_incident_actions_incident ON agent_incident_actions(incident_id);
