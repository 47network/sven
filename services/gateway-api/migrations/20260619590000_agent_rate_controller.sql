CREATE TABLE IF NOT EXISTS agent_rate_controller_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  controller_name TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'token_bucket',
  default_rate_limit INTEGER DEFAULT 1000,
  default_burst_size INTEGER DEFAULT 100,
  window_size_seconds INTEGER DEFAULT 60,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rate_limit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_rate_controller_configs(id),
  rule_name TEXT NOT NULL,
  target_key TEXT NOT NULL,
  rate_limit INTEGER NOT NULL,
  burst_size INTEGER DEFAULT 50,
  window_seconds INTEGER DEFAULT 60,
  action_on_exceed TEXT NOT NULL DEFAULT 'reject',
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_rate_limit_rules(id),
  client_key TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'limited',
  tokens_remaining INTEGER,
  request_count INTEGER DEFAULT 1,
  occurred_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rate_rules_config ON agent_rate_limit_rules(config_id);
CREATE INDEX idx_rate_events_rule ON agent_rate_limit_events(rule_id);
