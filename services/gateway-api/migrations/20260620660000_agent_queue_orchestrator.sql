-- Batch 429: Queue Orchestrator
CREATE TABLE IF NOT EXISTS agent_queue_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_backend TEXT NOT NULL DEFAULT 'nats' CHECK (default_backend IN ('nats','redis','rabbitmq','kafka','sqs')),
  max_retries INTEGER NOT NULL DEFAULT 3,
  dead_letter_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_managed_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_queue_orchestrator_configs(id),
  queue_name TEXT NOT NULL,
  backend TEXT NOT NULL,
  consumer_count INTEGER NOT NULL DEFAULT 1,
  message_count BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draining','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_queue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES agent_managed_queues(id),
  enqueued BIGINT NOT NULL DEFAULT 0,
  dequeued BIGINT NOT NULL DEFAULT 0,
  failed BIGINT NOT NULL DEFAULT 0,
  dead_lettered BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_queue_orchestrator_configs_agent ON agent_queue_orchestrator_configs(agent_id);
CREATE INDEX idx_agent_managed_queues_config ON agent_managed_queues(config_id);
CREATE INDEX idx_agent_queue_metrics_queue ON agent_queue_metrics(queue_id);
