-- Batch 156: Agent Feature Flags
-- Dynamic feature toggling for agent capabilities

CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID,
  flag_key TEXT NOT NULL,
  flag_kind TEXT NOT NULL DEFAULT 'boolean' CHECK (flag_kind IN ('boolean','percentage','variant','schedule')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  default_value JSONB NOT NULL DEFAULT 'false',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flag_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES agent_feature_flags(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 0,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('agent_id','archetype','tag','percentage','schedule','always')),
  condition_value JSONB NOT NULL DEFAULT '{}',
  serve_value JSONB NOT NULL DEFAULT 'true',
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES agent_feature_flags(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  rule_id UUID REFERENCES feature_flag_rules(id) ON DELETE SET NULL,
  evaluated_value JSONB NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flags_agent ON agent_feature_flags(agent_id);
CREATE INDEX idx_feature_flags_key ON agent_feature_flags(flag_key);
CREATE INDEX idx_feature_flags_kind ON agent_feature_flags(flag_kind);
CREATE INDEX idx_feature_rules_flag ON feature_flag_rules(flag_id);
CREATE INDEX idx_feature_evals_flag ON feature_flag_evaluations(flag_id);
CREATE INDEX idx_feature_evals_agent ON feature_flag_evaluations(agent_id);
