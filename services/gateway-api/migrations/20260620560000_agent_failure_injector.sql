CREATE TABLE IF NOT EXISTS agent_failure_injector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_service TEXT NOT NULL,
  failure_types JSONB NOT NULL DEFAULT '["latency","error","crash"]',
  blast_radius TEXT NOT NULL DEFAULT 'single',
  safety_limits JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_failure_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_failure_injector_configs(id),
  name TEXT NOT NULL,
  hypothesis TEXT,
  failure_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  results JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS agent_failure_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES agent_failure_experiments(id),
  impact_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  recovery_time_ms INTEGER,
  findings JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_failure_experiments_config ON agent_failure_experiments(config_id);
CREATE INDEX idx_agent_failure_reports_experiment ON agent_failure_reports(experiment_id);
