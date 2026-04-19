-- Batch 157: Agent Chaos Testing
-- Controlled fault injection for resilience testing

CREATE TABLE IF NOT EXISTS chaos_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  hypothesis TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed','aborted')),
  blast_radius TEXT NOT NULL DEFAULT 'single' CHECK (blast_radius IN ('single','crew','district','global')),
  duration_ms INT NOT NULL DEFAULT 60000,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chaos_faults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES chaos_experiments(id) ON DELETE CASCADE,
  fault_type TEXT NOT NULL CHECK (fault_type IN ('latency','error','timeout','partition','resource_exhaustion','data_corruption')),
  target_agent_id UUID,
  target_service TEXT,
  intensity NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  config JSONB NOT NULL DEFAULT '{}',
  injected_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chaos_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES chaos_experiments(id) ON DELETE CASCADE,
  fault_id UUID REFERENCES chaos_faults(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  baseline_value NUMERIC(12,4),
  actual_value NUMERIC(12,4),
  threshold NUMERIC(12,4),
  passed BOOLEAN NOT NULL DEFAULT true,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chaos_experiments_agent ON chaos_experiments(agent_id);
CREATE INDEX idx_chaos_experiments_status ON chaos_experiments(status);
CREATE INDEX idx_chaos_faults_experiment ON chaos_faults(experiment_id);
CREATE INDEX idx_chaos_faults_type ON chaos_faults(fault_type);
CREATE INDEX idx_chaos_results_experiment ON chaos_results(experiment_id);
CREATE INDEX idx_chaos_results_passed ON chaos_results(passed);
