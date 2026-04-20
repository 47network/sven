-- Batch 232: Incident Manager
-- Manages security incidents, response workflows, and post-mortems

CREATE TABLE IF NOT EXISTS agent_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  incident_type VARCHAR(64) NOT NULL CHECK (incident_type IN ('security_breach', 'data_leak', 'service_outage', 'unauthorized_access', 'malware', 'ddos', 'configuration_drift')),
  severity VARCHAR(32) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
  assigned_to UUID,
  impact_scope JSONB DEFAULT '{}',
  timeline JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_incident_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES agent_incidents(id),
  responder_id UUID NOT NULL,
  action_type VARCHAR(64) NOT NULL CHECK (action_type IN ('investigate', 'contain', 'eradicate', 'recover', 'communicate', 'escalate')),
  action_detail TEXT NOT NULL,
  outcome TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES agent_incidents(id),
  root_cause TEXT NOT NULL,
  contributing_factors JSONB DEFAULT '[]',
  lessons_learned JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  timeline_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_agent ON agent_incidents(agent_id);
CREATE INDEX idx_incidents_status ON agent_incidents(status);
CREATE INDEX idx_incidents_severity ON agent_incidents(severity);
CREATE INDEX idx_incident_responses_incident ON agent_incident_responses(incident_id);
CREATE INDEX idx_postmortems_incident ON agent_postmortems(incident_id);
