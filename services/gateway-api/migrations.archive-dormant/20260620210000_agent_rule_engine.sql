CREATE TABLE IF NOT EXISTS agent_rule_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  evaluation_mode TEXT NOT NULL DEFAULT 'sequential',
  conflict_resolution TEXT NOT NULL DEFAULT 'priority',
  max_rules_per_set INTEGER NOT NULL DEFAULT 100,
  caching_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_rule_engine_configs(id),
  agent_id UUID NOT NULL,
  rule_set_name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  rule_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES agent_rule_sets(id),
  rule_name TEXT NOT NULL,
  condition_expression JSONB NOT NULL,
  action_expression JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rule_sets_agent ON agent_rule_sets(agent_id);
CREATE INDEX IF NOT EXISTS idx_rules_rule_set ON agent_rules(rule_set_id);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON agent_rules(priority DESC);
