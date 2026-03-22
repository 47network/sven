-- Migration 120: Tenant billing / usage metering ledger

CREATE TABLE IF NOT EXISTS tenant_usage_events (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('llm', 'tool', 'storage', 'network', 'compute', 'custom')),
  metric_type     TEXT NOT NULL CHECK (metric_type IN ('tokens', 'requests', 'seconds', 'bytes', 'usd', 'events')),
  quantity        NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_cost_usd   NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (unit_cost_usd >= 0),
  total_cost_usd  NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (total_cost_usd >= 0),
  feature_key     TEXT,
  user_id         TEXT,
  session_id      TEXT,
  model_id        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_events_org_time
  ON tenant_usage_events (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_events_org_source_time
  ON tenant_usage_events (organization_id, source, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_events_org_feature_time
  ON tenant_usage_events (organization_id, feature_key, occurred_at DESC);
