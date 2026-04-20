-- Batch 338: Feature Flag Management
CREATE TABLE IF NOT EXISTS agent_feature_flag_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  max_flags INTEGER DEFAULT 500,
  default_rollout_pct INTEGER DEFAULT 0,
  evaluation_mode TEXT DEFAULT 'server',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_feature_flag_configs(id),
  flag_key TEXT NOT NULL,
  description TEXT,
  flag_type TEXT DEFAULT 'boolean',
  default_value JSONB DEFAULT 'false',
  rollout_percentage INTEGER DEFAULT 0,
  targeting_rules JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(config_id, flag_key)
);

CREATE TABLE IF NOT EXISTS agent_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES agent_feature_flags(id),
  context JSONB DEFAULT '{}',
  result JSONB NOT NULL,
  reason TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_flags_config ON agent_feature_flags(config_id);
CREATE INDEX idx_feature_flags_key ON agent_feature_flags(flag_key);
CREATE INDEX idx_flag_evals_flag ON agent_flag_evaluations(flag_id);
