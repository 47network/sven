-- Batch 101: Agent Chaos Engineering
CREATE TABLE IF NOT EXISTS agent_chaos_experiments (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  experiment_name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  target_service TEXT NOT NULL,
  fault_type TEXT NOT NULL DEFAULT 'latency',
  fault_config JSONB NOT NULL DEFAULT '{}',
  blast_radius TEXT NOT NULL DEFAULT 'single_instance',
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  rollback_strategy TEXT NOT NULL DEFAULT 'automatic',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_chaos_runs (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES agent_chaos_experiments(id),
  started_by TEXT NOT NULL,
  steady_state_before JSONB NOT NULL DEFAULT '{}',
  steady_state_after JSONB,
  hypothesis_confirmed BOOLEAN,
  incidents_triggered INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_chaos_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_chaos_runs(id),
  finding_type TEXT NOT NULL DEFAULT 'weakness',
  severity TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  affected_service TEXT NOT NULL,
  remediation TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chaos_experiments_agent ON agent_chaos_experiments(agent_id);
CREATE INDEX IF NOT EXISTS idx_chaos_runs_experiment ON agent_chaos_runs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_chaos_findings_run ON agent_chaos_findings(run_id);
