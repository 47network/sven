CREATE TABLE IF NOT EXISTS agent_sla_tracker_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_target NUMERIC(5,2) NOT NULL DEFAULT 99.90,
  measurement_window TEXT NOT NULL DEFAULT '30d',
  burn_rate_threshold NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  error_budget_alert NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_sla_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_sla_tracker_configs(id),
  agent_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  sli_type TEXT NOT NULL DEFAULT 'availability',
  target_percentage NUMERIC(5,2) NOT NULL,
  current_percentage NUMERIC(5,2),
  error_budget_remaining NUMERIC(5,2),
  measurement_start TIMESTAMPTZ NOT NULL,
  measurement_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'met',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES agent_sla_objectives(id),
  violation_type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  impact_percentage NUMERIC(5,2),
  root_cause TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sla_objectives_agent ON agent_sla_objectives(agent_id);
CREATE INDEX IF NOT EXISTS idx_sla_objectives_status ON agent_sla_objectives(status);
CREATE INDEX IF NOT EXISTS idx_sla_violations_objective ON agent_sla_violations(objective_id);
