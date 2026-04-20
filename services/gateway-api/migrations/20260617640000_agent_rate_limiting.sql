CREATE TABLE IF NOT EXISTS agent_rate_limit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','per_agent','per_ip','per_api_key','per_endpoint')),
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  burst_limit INTEGER,
  throttle_strategy TEXT NOT NULL DEFAULT 'reject' CHECK (throttle_strategy IN ('reject','queue','throttle','degrade')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_rate_limit_policies(id),
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rate_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_rate_limit_policies(id),
  identifier TEXT NOT NULL,
  override_type TEXT NOT NULL CHECK (override_type IN ('whitelist','blacklist','custom_limit','temporary_boost')),
  custom_max_requests INTEGER,
  custom_window_seconds INTEGER,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rl_policies_agent ON agent_rate_limit_policies(agent_id);
CREATE INDEX idx_rl_policies_scope ON agent_rate_limit_policies(scope);
CREATE INDEX idx_rl_counters_policy ON agent_rate_limit_counters(policy_id);
CREATE INDEX idx_rl_counters_window ON agent_rate_limit_counters(window_start);
CREATE INDEX idx_rl_overrides_policy ON agent_rate_limit_overrides(policy_id);
CREATE INDEX idx_rl_overrides_id ON agent_rate_limit_overrides(identifier);
