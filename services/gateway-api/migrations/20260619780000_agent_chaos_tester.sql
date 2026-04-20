-- Batch 341: Chaos Tester
CREATE TABLE IF NOT EXISTS agent_chaos_tester_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  max_concurrent_experiments INTEGER DEFAULT 3,
  blast_radius_limit TEXT DEFAULT 'service',
  safety_mode BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_chaos_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_chaos_tester_configs(id),
  experiment_name TEXT NOT NULL,
  experiment_type TEXT NOT NULL,
  target_service TEXT,
  hypothesis TEXT,
  parameters JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_chaos_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES agent_chaos_experiments(id),
  hypothesis_confirmed BOOLEAN,
  observations JSONB DEFAULT '[]',
  impact_score NUMERIC(5,2),
  recommendations JSONB DEFAULT '[]',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chaos_experiments_config ON agent_chaos_experiments(config_id);
CREATE INDEX idx_chaos_results_experiment ON agent_chaos_results(experiment_id);
