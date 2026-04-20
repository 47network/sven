CREATE TABLE IF NOT EXISTS agent_incident_tracker_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity_levels TEXT[] NOT NULL DEFAULT ARRAY['critical','high','medium','low'],
  escalation_policy JSONB NOT NULL DEFAULT '{}',
  auto_assign BOOLEAN NOT NULL DEFAULT false,
  sla_targets JSONB NOT NULL DEFAULT '{}',
  notification_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_tracker_agent ON agent_incident_tracker_configs(agent_id);
CREATE INDEX idx_incident_tracker_enabled ON agent_incident_tracker_configs(enabled);
