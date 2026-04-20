-- Batch 391: Webhook Orchestrator
CREATE TABLE IF NOT EXISTS agent_webhook_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_retries INT DEFAULT 3,
  retry_delay_ms INT DEFAULT 5000,
  signature_algorithm TEXT DEFAULT 'hmac-sha256',
  delivery_timeout_ms INT DEFAULT 10000,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_webhook_orchestrator_configs(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  headers JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  success_count BIGINT DEFAULT 0,
  failure_count BIGINT DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_webhook_endpoints(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  attempt_count INT DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','retrying')),
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_whk_configs_agent ON agent_webhook_orchestrator_configs(agent_id);
CREATE INDEX idx_whk_endpoints_config ON agent_webhook_endpoints(config_id);
CREATE INDEX idx_whk_endpoints_active ON agent_webhook_endpoints(active);
CREATE INDEX idx_whk_deliveries_endpoint ON agent_webhook_deliveries(endpoint_id);
CREATE INDEX idx_whk_deliveries_status ON agent_webhook_deliveries(status);
