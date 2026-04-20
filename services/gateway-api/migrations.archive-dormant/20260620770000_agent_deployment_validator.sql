-- Batch 440: Deployment Validator
CREATE TABLE IF NOT EXISTS agent_deployment_validator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  validation_timeout_ms INTEGER NOT NULL DEFAULT 300000,
  required_checks TEXT[] DEFAULT '{"health","smoke","integration"}',
  fail_fast BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_deployment_validator_configs(id),
  deployment_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','passed','failed','skipped')),
  checks_total INTEGER NOT NULL DEFAULT 0,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_validation_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_validation_runs(id),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','passed','failed','skipped')),
  output JSONB DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_deployment_validator_configs_agent ON agent_deployment_validator_configs(agent_id);
CREATE INDEX idx_agent_validation_runs_config ON agent_validation_runs(config_id);
CREATE INDEX idx_agent_validation_checks_run ON agent_validation_checks(run_id);
