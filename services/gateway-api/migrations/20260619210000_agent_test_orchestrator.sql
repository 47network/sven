-- Batch 284: Test Orchestrator
CREATE TABLE IF NOT EXISTS agent_test_orch_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  framework TEXT NOT NULL DEFAULT 'jest',
  test_directory TEXT DEFAULT 'src/__tests__',
  parallel_workers INTEGER DEFAULT 4,
  coverage_threshold NUMERIC(5,2) DEFAULT 80.00,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_test_orch_configs(id),
  suite_name TEXT NOT NULL,
  total_tests INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  coverage_percent NUMERIC(5,2),
  duration_ms INTEGER,
  state TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_test_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_test_runs(id),
  test_name TEXT NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  retry_count INTEGER DEFAULT 0,
  fixed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_test_orch_configs_agent ON agent_test_orch_configs(agent_id);
CREATE INDEX idx_test_runs_config ON agent_test_runs(config_id);
CREATE INDEX idx_test_failures_run ON agent_test_failures(run_id);
