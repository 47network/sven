-- Batch 121 — Incident Escalation
-- Manages incident response workflows, escalation chains, and on-call schedules

CREATE TABLE IF NOT EXISTS agent_escalation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  severity_threshold TEXT NOT NULL DEFAULT 'warning' CHECK (severity_threshold IN ('critical','high','warning','low')),
  auto_escalate_after_mins INT NOT NULL DEFAULT 30,
  max_escalation_level INT NOT NULL DEFAULT 3,
  notification_channels JSONB NOT NULL DEFAULT '["nats"]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_escalation_policies(id),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','warning','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','investigating','mitigating','resolved','closed')),
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system','agent','manual','alert')),
  affected_services JSONB NOT NULL DEFAULT '[]',
  current_escalation_level INT NOT NULL DEFAULT 0,
  assigned_agent_id UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  root_cause TEXT,
  resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS agent_escalation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES agent_incidents(id) ON DELETE CASCADE,
  escalation_level INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('notify','escalate','assign','acknowledge','resolve','comment')),
  target_agent_id UUID,
  channel TEXT NOT NULL DEFAULT 'nats',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalation_policies_agent ON agent_escalation_policies(agent_id);
CREATE INDEX idx_incidents_policy ON agent_incidents(policy_id);
CREATE INDEX idx_incidents_status ON agent_incidents(status);
CREATE INDEX idx_incidents_severity ON agent_incidents(severity);
CREATE INDEX idx_incidents_assigned ON agent_incidents(assigned_agent_id);
CREATE INDEX idx_escalation_logs_incident ON agent_escalation_logs(incident_id);
