-- Batch 347: Test Harness
CREATE TABLE IF NOT EXISTS agent_test_harness_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  parallel_suites INTEGER DEFAULT 4,
  timeout_seconds INTEGER DEFAULT 300,
  retry_failed BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_test_harness_configs(id),
  suite_name TEXT NOT NULL,
  suite_type TEXT DEFAULT 'unit',
  test_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS agent_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES agent_test_suites(id),
  test_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  assertion_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  executed_at TIMESTAMPTZ
);

CREATE INDEX idx_test_suites_config ON agent_test_suites(config_id);
CREATE INDEX idx_test_cases_suite ON agent_test_cases(suite_id);
