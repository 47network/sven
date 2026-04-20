-- Batch 356: Feature Toggle — feature flag management and rollout
CREATE TABLE IF NOT EXISTS agent_feature_toggle_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  rollout_strategy TEXT NOT NULL DEFAULT 'percentage' CHECK (rollout_strategy IN ('percentage','user_list','gradual','ring','canary')),
  default_state BOOLEAN NOT NULL DEFAULT false,
  evaluation_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feature_toggle_configs_agent ON agent_feature_toggle_configs(agent_id);

CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_feature_toggle_configs(id),
  flag_key TEXT NOT NULL,
  flag_name TEXT NOT NULL,
  description TEXT,
  flag_type TEXT NOT NULL DEFAULT 'boolean' CHECK (flag_type IN ('boolean','string','number','json')),
  default_value JSONB NOT NULL DEFAULT 'false',
  current_value JSONB,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  target_rules JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, flag_key)
);
CREATE INDEX idx_feature_flags_config ON agent_feature_flags(config_id);
CREATE INDEX idx_feature_flags_key ON agent_feature_flags(flag_key);

CREATE TABLE IF NOT EXISTS agent_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES agent_feature_flags(id),
  context JSONB NOT NULL DEFAULT '{}',
  evaluated_value JSONB NOT NULL,
  rule_matched TEXT,
  evaluation_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flag_evaluations_flag ON agent_flag_evaluations(flag_id);
