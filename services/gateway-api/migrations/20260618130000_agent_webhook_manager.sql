-- Batch 176: Agent Webhook Manager
-- Manages inbound/outbound webhooks with retry logic,
-- signature verification, payload transformation, and delivery tracking

CREATE TABLE IF NOT EXISTS agent_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  endpoint_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound','bidirectional')),
  url TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST' CHECK (http_method IN ('POST','PUT','PATCH','GET','DELETE')),
  secret_key TEXT,
  signature_header TEXT DEFAULT 'X-Webhook-Signature',
  content_type TEXT NOT NULL DEFAULT 'application/json',
  event_types TEXT[] NOT NULL DEFAULT '{}',
  transform_template JSONB,
  retry_policy JSONB NOT NULL DEFAULT '{"max_retries": 3, "backoff_ms": 1000, "backoff_multiplier": 2}',
  rate_limit_per_min INTEGER DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_webhook_endpoints(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed','retrying','expired')),
  http_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES agent_webhook_deliveries(id),
  attempt_number INTEGER NOT NULL,
  http_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  headers_sent JSONB,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_endpoints_agent ON agent_webhook_endpoints(agent_id);
CREATE INDEX idx_webhook_deliveries_endpoint ON agent_webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON agent_webhook_deliveries(status);
CREATE INDEX idx_webhook_logs_delivery ON agent_webhook_logs(delivery_id);
