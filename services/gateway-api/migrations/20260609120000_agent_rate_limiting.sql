-- Batch 67: Agent Rate Limiting & Throttling
-- Protect services from overuse, enforce fair quotas, and manage burst capacity

CREATE TABLE IF NOT EXISTS rate_limit_policies (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  policy_name     TEXT NOT NULL,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('api','task','skill','model','storage','network')),
  max_requests    INTEGER NOT NULL DEFAULT 1000,
  window_seconds  INTEGER NOT NULL DEFAULT 3600,
  burst_limit     INTEGER,
  throttle_strategy TEXT NOT NULL DEFAULT 'sliding_window' CHECK (throttle_strategy IN ('sliding_window','fixed_window','token_bucket','leaky_bucket')),
  priority        INTEGER NOT NULL DEFAULT 5,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT NOT NULL REFERENCES rate_limit_policies(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  request_count   INTEGER NOT NULL DEFAULT 0,
  burst_count     INTEGER NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT NOT NULL REFERENCES rate_limit_policies(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  override_type   TEXT NOT NULL CHECK (override_type IN ('increase','decrease','exempt','temporary')),
  max_requests    INTEGER,
  window_seconds  INTEGER,
  reason          TEXT,
  expires_at      TIMESTAMPTZ,
  granted_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS throttle_events (
  id              TEXT PRIMARY KEY,
  policy_id       TEXT NOT NULL REFERENCES rate_limit_policies(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN ('throttled','blocked','warned','burst_exceeded','quota_reset')),
  request_count   INTEGER NOT NULL,
  limit_value     INTEGER NOT NULL,
  retry_after     INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quota_allocations (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  allocated       INTEGER NOT NULL DEFAULT 0,
  consumed        INTEGER NOT NULL DEFAULT 0,
  remaining       INTEGER GENERATED ALWAYS AS (allocated - consumed) STORED,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  auto_renew      BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_policies_agent ON rate_limit_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_policies_resource ON rate_limit_policies(resource_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_policies_enabled ON rate_limit_policies(enabled);
CREATE INDEX IF NOT EXISTS idx_rate_limit_policies_priority ON rate_limit_policies(priority);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_policy ON rate_limit_counters(policy_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_agent ON rate_limit_counters(agent_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window ON rate_limit_counters(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_last ON rate_limit_counters(last_request_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_policy ON rate_limit_overrides(policy_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_agent ON rate_limit_overrides(agent_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_expires ON rate_limit_overrides(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_type ON rate_limit_overrides(override_type);
CREATE INDEX IF NOT EXISTS idx_throttle_events_policy ON throttle_events(policy_id);
CREATE INDEX IF NOT EXISTS idx_throttle_events_agent ON throttle_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_throttle_events_type ON throttle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_throttle_events_created ON throttle_events(created_at);
CREATE INDEX IF NOT EXISTS idx_quota_allocations_agent ON quota_allocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_quota_allocations_resource ON quota_allocations(resource_type);
CREATE INDEX IF NOT EXISTS idx_quota_allocations_period ON quota_allocations(period_start, period_end);
