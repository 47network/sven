-- Batch 431: Message Broker Admin
CREATE TABLE IF NOT EXISTS agent_message_broker_admin_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  broker_type TEXT NOT NULL DEFAULT 'nats' CHECK (broker_type IN ('nats','rabbitmq','kafka','redis_streams','pulsar')),
  connection_url TEXT NOT NULL,
  monitoring_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_broker_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_message_broker_admin_configs(id),
  topic_name TEXT NOT NULL,
  partition_count INTEGER NOT NULL DEFAULT 1,
  retention_hours INTEGER NOT NULL DEFAULT 168,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_broker_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_message_broker_admin_configs(id),
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','degraded','unhealthy','unreachable')),
  latency_ms INTEGER,
  message_rate NUMERIC(12,2),
  error_rate NUMERIC(5,2) DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_message_broker_admin_configs_agent ON agent_message_broker_admin_configs(agent_id);
CREATE INDEX idx_agent_broker_topics_config ON agent_broker_topics(config_id);
CREATE INDEX idx_agent_broker_health_checks_config ON agent_broker_health_checks(config_id);
