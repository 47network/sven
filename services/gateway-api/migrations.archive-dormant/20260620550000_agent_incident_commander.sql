CREATE TABLE IF NOT EXISTS agent_incident_commander_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  severity_levels JSONB NOT NULL DEFAULT '["critical","high","medium","low"]',
  escalation_policy JSONB NOT NULL DEFAULT '{}',
  on_call_schedule JSONB NOT NULL DEFAULT '{}',
  auto_assign BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_incident_commander_configs(id),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_agent_id UUID,
  root_cause TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_incident_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES agent_incidents(id),
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_agent_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_incidents_config ON agent_incidents(config_id);
CREATE INDEX idx_agent_incidents_status ON agent_incidents(status);
CREATE INDEX idx_agent_incident_timelines_incident ON agent_incident_timelines(incident_id);
