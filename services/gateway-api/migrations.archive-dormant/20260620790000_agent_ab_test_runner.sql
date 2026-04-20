-- Batch 442: A/B Test Runner
CREATE TABLE IF NOT EXISTS agent_ab_test_runner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  min_sample_size INTEGER NOT NULL DEFAULT 1000,
  confidence_level NUMERIC(3,2) NOT NULL DEFAULT 0.95,
  max_duration_days INTEGER NOT NULL DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_ab_test_runner_configs(id),
  name TEXT NOT NULL,
  hypothesis TEXT,
  control_variant JSONB NOT NULL DEFAULT '{}',
  test_variant JSONB NOT NULL DEFAULT '{}',
  traffic_split INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','concluded','cancelled')),
  winner TEXT CHECK (winner IN ('control','test','inconclusive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_ab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES agent_ab_tests(id),
  variant TEXT NOT NULL CHECK (variant IN ('control','test')),
  impressions BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,4) DEFAULT 0,
  p_value NUMERIC(6,5),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_ab_test_runner_configs_agent ON agent_ab_test_runner_configs(agent_id);
CREATE INDEX idx_agent_ab_tests_config ON agent_ab_tests(config_id);
CREATE INDEX idx_agent_ab_results_test ON agent_ab_results(test_id);
