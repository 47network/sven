-- Batch 146: Agent Throttle Control
-- Rate limiting and flow control for agent operations

CREATE TABLE IF NOT EXISTS throttle_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  name            TEXT NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('global','agent','skill','endpoint','resource')),
  mode            TEXT NOT NULL DEFAULT 'rate_limit' CHECK (mode IN ('rate_limit','concurrency','burst','adaptive','circuit_breaker')),
  max_rate        INTEGER NOT NULL CHECK (max_rate > 0),
  window_seconds  INTEGER NOT NULL DEFAULT 60,
  burst_size      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS throttle_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES throttle_rules(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agents(id),
  action          TEXT NOT NULL CHECK (action IN ('allowed','throttled','queued','rejected','circuit_opened','circuit_closed')),
  request_key     TEXT,
  current_rate    REAL NOT NULL DEFAULT 0,
  wait_ms         INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS throttle_counters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES throttle_rules(id) ON DELETE CASCADE,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  request_count   INTEGER NOT NULL DEFAULT 0,
  rejected_count  INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms  REAL NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_throttle_rules_agent ON throttle_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_throttle_rules_scope ON throttle_rules(scope);
CREATE INDEX IF NOT EXISTS idx_throttle_events_rule ON throttle_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_throttle_events_action ON throttle_events(action);
CREATE INDEX IF NOT EXISTS idx_throttle_counters_rule ON throttle_counters(rule_id);
CREATE INDEX IF NOT EXISTS idx_throttle_counters_window ON throttle_counters(window_start);
