-- Batch 438: Feature Flag Manager
CREATE TABLE IF NOT EXISTS agent_feature_flag_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_strategy TEXT NOT NULL DEFAULT 'boolean' CHECK (default_strategy IN ('boolean','percentage','user_list','gradual','schedule')),
  stale_flag_days INTEGER NOT NULL DEFAULT 90,
  audit_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_feature_flag_manager_configs(id),
  flag_key TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  strategy TEXT NOT NULL DEFAULT 'boolean',
  rollout_percentage INTEGER DEFAULT 0,
  targeting_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES agent_feature_flags(id),
  context JSONB NOT NULL DEFAULT '{}',
  result BOOLEAN NOT NULL,
  reason TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_feature_flag_manager_configs_agent ON agent_feature_flag_manager_configs(agent_id);
CREATE INDEX idx_agent_feature_flags_config ON agent_feature_flags(config_id);
CREATE INDEX idx_agent_flag_evaluations_flag ON agent_flag_evaluations(flag_id);
