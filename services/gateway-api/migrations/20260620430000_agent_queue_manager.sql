-- Batch 406: Queue Manager
-- Manages message queues for async agent communication with DLQ and rate limiting

CREATE TABLE IF NOT EXISTS agent_queue_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_queues INTEGER NOT NULL DEFAULT 50,
  default_retention_hours INTEGER NOT NULL DEFAULT 168,
  rate_limit_per_second INTEGER NOT NULL DEFAULT 100,
  dlq_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_queue_manager_configs(id),
  name TEXT NOT NULL,
  queue_type TEXT NOT NULL DEFAULT 'standard' CHECK (queue_type IN ('standard', 'fifo', 'priority', 'delay', 'dead_letter')),
  max_size INTEGER NOT NULL DEFAULT 10000,
  current_size INTEGER NOT NULL DEFAULT 0,
  consumers INTEGER NOT NULL DEFAULT 0,
  visibility_timeout_seconds INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_id, name)
);

CREATE TABLE IF NOT EXISTS agent_queue_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES agent_queues(id),
  body JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'processing', 'completed', 'failed', 'dead_letter')),
  receive_count INTEGER NOT NULL DEFAULT 0,
  visible_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_queues_config ON agent_queues(config_id);
CREATE INDEX idx_agent_queue_messages_queue ON agent_queue_messages(queue_id);
CREATE INDEX idx_agent_queue_messages_visible ON agent_queue_messages(queue_id, status, visible_at);
