-- Batch 115: Agent Webhook Retry
-- Manages webhook delivery, retry queues, and dead letter handling

CREATE TABLE IF NOT EXISTS agent_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  endpoint_url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT '{}',
  max_retries INT NOT NULL DEFAULT 5,
  retry_backoff TEXT NOT NULL DEFAULT 'exponential',
  timeout_ms INT NOT NULL DEFAULT 10000,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_webhook_endpoints(id),
  agent_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  status_code INT,
  response_time_ms INT,
  status TEXT NOT NULL DEFAULT 'pending',
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_webhook_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES agent_webhook_deliveries(id),
  endpoint_id UUID NOT NULL REFERENCES agent_webhook_endpoints(id),
  agent_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  total_attempts INT NOT NULL,
  last_status_code INT,
  requeued BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_agent ON agent_webhook_endpoints(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON agent_webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_agent ON agent_webhook_deliveries(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON agent_webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON agent_webhook_deliveries(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_dead_letters_endpoint ON agent_webhook_dead_letters(endpoint_id);
