-- Batch 84: Agent Circuit Breaker
-- Circuit breaker patterns for agent service resilience

CREATE TABLE IF NOT EXISTS circuit_breakers (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  target_service TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_threshold INTEGER NOT NULL DEFAULT 5,
  success_threshold INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  half_opened_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id TEXT PRIMARY KEY,
  breaker_id TEXT NOT NULL REFERENCES circuit_breakers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('state_change','failure','success','timeout','reset','trip','probe')),
  from_state TEXT,
  to_state TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  failure_threshold INTEGER NOT NULL DEFAULT 5,
  success_threshold INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  half_open_max_calls INTEGER NOT NULL DEFAULT 1,
  sliding_window_size INTEGER NOT NULL DEFAULT 10,
  sliding_window_type TEXT NOT NULL DEFAULT 'count' CHECK (sliding_window_type IN ('count','time')),
  slow_call_threshold_ms INTEGER NOT NULL DEFAULT 5000,
  slow_call_rate_threshold NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_fallbacks (
  id TEXT PRIMARY KEY,
  breaker_id TEXT NOT NULL REFERENCES circuit_breakers(id) ON DELETE CASCADE,
  fallback_type TEXT NOT NULL CHECK (fallback_type IN ('cache','default_value','alternate_service','queue','reject','custom')),
  fallback_config JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_metrics (
  id TEXT PRIMARY KEY,
  breaker_id TEXT NOT NULL REFERENCES circuit_breakers(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  rejected_calls INTEGER NOT NULL DEFAULT 0,
  timeout_calls INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  p99_latency_ms NUMERIC(10,2),
  error_rate NUMERIC(5,2),
  state_changes INTEGER NOT NULL DEFAULT 0,
  fallback_invocations INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_circuit_breakers_service ON circuit_breakers(service_id);
CREATE INDEX idx_circuit_breakers_target ON circuit_breakers(target_service);
CREATE INDEX idx_circuit_breakers_state ON circuit_breakers(state);
CREATE INDEX idx_circuit_breakers_updated ON circuit_breakers(updated_at DESC);
CREATE INDEX idx_cb_events_breaker ON circuit_breaker_events(breaker_id);
CREATE INDEX idx_cb_events_type ON circuit_breaker_events(event_type);
CREATE INDEX idx_cb_events_created ON circuit_breaker_events(created_at DESC);
CREATE INDEX idx_cb_events_breaker_created ON circuit_breaker_events(breaker_id, created_at DESC);
CREATE INDEX idx_cb_policies_name ON circuit_breaker_policies(name);
CREATE INDEX idx_cb_policies_default ON circuit_breaker_policies(is_default) WHERE is_default = true;
CREATE INDEX idx_cb_fallbacks_breaker ON circuit_breaker_fallbacks(breaker_id);
CREATE INDEX idx_cb_fallbacks_type ON circuit_breaker_fallbacks(fallback_type);
CREATE INDEX idx_cb_fallbacks_active ON circuit_breaker_fallbacks(is_active) WHERE is_active = true;
CREATE INDEX idx_cb_fallbacks_priority ON circuit_breaker_fallbacks(breaker_id, priority DESC);
CREATE INDEX idx_cb_metrics_breaker ON circuit_breaker_metrics(breaker_id);
CREATE INDEX idx_cb_metrics_period ON circuit_breaker_metrics(period_start, period_end);
CREATE INDEX idx_cb_metrics_breaker_period ON circuit_breaker_metrics(breaker_id, period_start DESC);
CREATE INDEX idx_cb_metrics_error_rate ON circuit_breaker_metrics(error_rate DESC);
CREATE INDEX idx_cb_metrics_created ON circuit_breaker_metrics(created_at DESC);
