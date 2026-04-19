-- Batch 415: Runbook Executor
CREATE TABLE IF NOT EXISTS agent_runbook_executor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_runs INT DEFAULT 5,
  timeout_seconds INT DEFAULT 3600,
  sandbox_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_runbook_executor_configs(id),
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  trigger_conditions JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id UUID NOT NULL REFERENCES agent_runbooks(id),
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','cancelled','timed_out')),
  current_step INT DEFAULT 0,
  step_results JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_runbook_configs_agent ON agent_runbook_executor_configs(agent_id);
CREATE INDEX idx_runbooks_config ON agent_runbooks(config_id);
CREATE INDEX idx_runbook_executions_runbook ON agent_runbook_executions(runbook_id);
CREATE INDEX idx_runbook_executions_status ON agent_runbook_executions(status);
