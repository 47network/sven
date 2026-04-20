-- Batch 411: Feature Flag Engine
-- Feature toggles with percentage rollouts, user targeting, and A/B testing

CREATE TABLE IF NOT EXISTS agent_feature_flag_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_feature_flag_engine_configs(id),
  flag_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  flag_type TEXT NOT NULL DEFAULT 'boolean' CHECK (flag_type IN ('boolean', 'percentage', 'variant', 'user_list')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage NUMERIC(5,2) DEFAULT 0,
  variants JSONB,
  targeting_rules JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, flag_key)
);

CREATE TABLE IF NOT EXISTS agent_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES agent_feature_flags(id),
  subject_id TEXT NOT NULL,
  result JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('default', 'targeting_match', 'percentage_rollout', 'variant_assigned', 'disabled', 'error')),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_feature_flags_config ON agent_feature_flags(config_id);
CREATE INDEX idx_agent_feature_flags_key ON agent_feature_flags(config_id, flag_key);
CREATE INDEX idx_agent_flag_evaluations_flag ON agent_flag_evaluations(flag_id);
