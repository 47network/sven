-- Batch 69: Agent Webhooks & External Integrations
-- Outbound webhook delivery, event subscriptions, retry logic, and integration management

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'POST' CHECK (method IN ('POST','PUT','PATCH')),
  headers         JSONB DEFAULT '{}',
  secret          TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  retry_policy    TEXT NOT NULL DEFAULT 'exponential' CHECK (retry_policy IN ('none','linear','exponential','fixed')),
  max_retries     INTEGER NOT NULL DEFAULT 3,
  timeout_ms      INTEGER NOT NULL DEFAULT 30000,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id              TEXT PRIMARY KEY,
  endpoint_id     TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  filter          JSONB DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  endpoint_id     TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed','retrying','cancelled')),
  attempt         INTEGER NOT NULL DEFAULT 0,
  response_code   INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id              TEXT PRIMARY KEY,
  delivery_id     TEXT NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
  attempt         INTEGER NOT NULL,
  request_url     TEXT NOT NULL,
  request_headers JSONB DEFAULT '{}',
  request_body    JSONB DEFAULT '{}',
  response_code   INTEGER,
  response_body   TEXT,
  duration_ms     INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_integrations (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  provider        TEXT NOT NULL,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('webhook','oauth','api_key','custom')),
  config          JSONB NOT NULL DEFAULT '{}',
  credentials     JSONB DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked','expired')),
  last_used_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_agent ON webhook_endpoints(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_enabled ON webhook_endpoints(enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_url ON webhook_endpoints(url);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_endpoint ON webhook_subscriptions(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event ON webhook_subscriptions(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_delivery ON webhook_logs(delivery_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_attempt ON webhook_logs(attempt);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_response ON webhook_logs(response_code);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_external_integrations_agent ON external_integrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_external_integrations_provider ON external_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_external_integrations_status ON external_integrations(status);
