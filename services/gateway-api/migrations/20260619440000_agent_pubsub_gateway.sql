-- Batch 307: PubSub Gateway
CREATE TABLE IF NOT EXISTS agent_pubsub_gw_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'nats', auth_mode TEXT NOT NULL DEFAULT 'token',
  max_subscriptions INTEGER DEFAULT 1000, ack_wait_seconds INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_pubsub_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_pubsub_gw_configs(id),
  topic_name TEXT NOT NULL, partitions INTEGER DEFAULT 1,
  retention_hours INTEGER DEFAULT 168, subscriber_count INTEGER DEFAULT 0,
  messages_total BIGINT DEFAULT 0, state TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_pubsub_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), topic_id UUID NOT NULL REFERENCES agent_pubsub_topics(id),
  subscriber_id TEXT NOT NULL, filter_expression TEXT,
  ack_pending INTEGER DEFAULT 0, delivered BIGINT DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pubsub_gw_configs_agent ON agent_pubsub_gw_configs(agent_id);
CREATE INDEX idx_pubsub_topics_config ON agent_pubsub_topics(config_id);
CREATE INDEX idx_pubsub_subs_topic ON agent_pubsub_subscriptions(topic_id);
