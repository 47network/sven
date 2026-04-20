-- Batch 105 — Agent Message Queue
-- Dead letter queues, retry policies, consumer groups

CREATE TABLE IF NOT EXISTS agent_mq_queues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  queue_name      TEXT NOT NULL,
  queue_type      TEXT NOT NULL DEFAULT 'standard' CHECK (queue_type IN ('standard','fifo','priority','delay')),
  max_retries     INTEGER NOT NULL DEFAULT 3,
  retry_delay_ms  INTEGER NOT NULL DEFAULT 1000,
  dlq_name        TEXT,
  visibility_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  message_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
  depth           BIGINT NOT NULL DEFAULT 0,
  in_flight       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mq_consumers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id        UUID NOT NULL REFERENCES agent_mq_queues(id) ON DELETE CASCADE,
  consumer_group  TEXT NOT NULL,
  consumer_id     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','draining','stopped')),
  messages_processed BIGINT NOT NULL DEFAULT 0,
  messages_failed BIGINT NOT NULL DEFAULT 0,
  last_ack_at     TIMESTAMPTZ,
  lag             BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mq_dlq_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id        UUID NOT NULL REFERENCES agent_mq_queues(id) ON DELETE CASCADE,
  original_id     TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  error_reason    TEXT NOT NULL,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_failed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  redriven        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mq_queues_agent ON agent_mq_queues(agent_id);
CREATE INDEX idx_mq_queues_name ON agent_mq_queues(queue_name);
CREATE INDEX idx_mq_consumers_queue ON agent_mq_consumers(queue_id);
CREATE INDEX idx_mq_consumers_group ON agent_mq_consumers(consumer_group);
CREATE INDEX idx_mq_dlq_queue ON agent_mq_dlq_messages(queue_id);
CREATE INDEX idx_mq_dlq_redriven ON agent_mq_dlq_messages(redriven);
