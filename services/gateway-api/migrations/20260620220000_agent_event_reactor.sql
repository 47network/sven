CREATE TABLE IF NOT EXISTS agent_event_reactor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_reactions_per_minute INTEGER NOT NULL DEFAULT 100,
  dedup_window_seconds INTEGER NOT NULL DEFAULT 60,
  dead_letter_enabled BOOLEAN NOT NULL DEFAULT true,
  batch_size INTEGER NOT NULL DEFAULT 10,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_event_reactor_configs(id),
  agent_id UUID NOT NULL,
  event_pattern TEXT NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'handler',
  filter_expression JSONB,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  invocation_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_event_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES agent_event_subscriptions(id),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reaction_status TEXT NOT NULL DEFAULT 'pending',
  input_data JSONB NOT NULL DEFAULT '{}',
  output_data JSONB,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_agent ON agent_event_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_pattern ON agent_event_subscriptions(event_pattern);
CREATE INDEX IF NOT EXISTS idx_event_reactions_subscription ON agent_event_reactions(subscription_id);
