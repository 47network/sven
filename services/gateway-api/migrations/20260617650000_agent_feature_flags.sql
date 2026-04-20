-- Batch 128: Agent Feature Flags
-- Provides feature toggle management, gradual rollouts, and A/B flag control

CREATE TABLE IF NOT EXISTS agent_feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  flag_key        TEXT NOT NULL,
  flag_type       TEXT NOT NULL CHECK (flag_type IN ('boolean','percentage','variant','schedule')),
  enabled         BOOLEAN NOT NULL DEFAULT false,
  rollout_pct     NUMERIC(5,2) DEFAULT 0 CHECK (rollout_pct >= 0 AND rollout_pct <= 100),
  variants        JSONB DEFAULT '[]'::jsonb,
  targeting_rules JSONB DEFAULT '{}'::jsonb,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, flag_key)
);

CREATE TABLE IF NOT EXISTS agent_flag_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id         UUID NOT NULL REFERENCES agent_feature_flags(id),
  context_key     TEXT NOT NULL,
  result          JSONB NOT NULL,
  variant_served  TEXT,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_flag_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id         UUID NOT NULL REFERENCES agent_feature_flags(id),
  change_type     TEXT NOT NULL CHECK (change_type IN ('created','toggled','rollout_changed','variant_added','archived')),
  old_value       JSONB,
  new_value       JSONB,
  changed_by      UUID,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flags_agent ON agent_feature_flags(agent_id);
CREATE INDEX idx_flag_evaluations_flag ON agent_flag_evaluations(flag_id);
CREATE INDEX idx_flag_audit_flag ON agent_flag_audit_log(flag_id);
