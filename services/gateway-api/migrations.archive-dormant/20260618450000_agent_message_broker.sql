-- Batch 208: message_broker
CREATE TABLE IF NOT EXISTS agent_message_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  broker_type VARCHAR(50) NOT NULL CHECK (broker_type IN ('rabbitmq','kafka','nats','redis_streams','pulsar','mqtt','activemq','zeromq')),
  connection_url TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connecting','connected','error','draining','maintenance')),
  max_connections INT DEFAULT 10,
  heartbeat_interval_ms INT DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, name)
);

CREATE TABLE IF NOT EXISTS agent_message_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES agent_message_brokers(id),
  name VARCHAR(255) NOT NULL,
  partition_count INT DEFAULT 1,
  replication_factor INT DEFAULT 1,
  retention_hours INT DEFAULT 168,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived','error')),
  message_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_message_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES agent_message_topics(id),
  subscriber_name VARCHAR(255) NOT NULL,
  filter_expression TEXT,
  delivery_mode VARCHAR(30) NOT NULL DEFAULT 'at_least_once' CHECK (delivery_mode IN ('at_most_once','at_least_once','exactly_once')),
  max_retries INT DEFAULT 3,
  dead_letter_topic VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','error')),
  lag BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_brokers_agent ON agent_message_brokers(agent_id);
CREATE INDEX idx_message_brokers_status ON agent_message_brokers(status);
CREATE INDEX idx_message_topics_broker ON agent_message_topics(broker_id);
CREATE INDEX idx_message_subscriptions_topic ON agent_message_subscriptions(topic_id);
