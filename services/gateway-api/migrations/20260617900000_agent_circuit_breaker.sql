-- Batch 153: Agent Circuit Breaker
-- Protects agent-to-agent calls with circuit breaker patterns

CREATE TABLE IF NOT EXISTS agent_circuit_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  failure_threshold INT NOT NULL DEFAULT 5,
  success_threshold INT NOT NULL DEFAULT 3,
  timeout_ms INT NOT NULL DEFAULT 30000,
  failure_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breaker_id UUID NOT NULL REFERENCES agent_circuit_breakers(id) ON DELETE CASCADE,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('open','half_open','close','reset')),
  reason TEXT,
  failure_count INT NOT NULL DEFAULT 0,
  duration_ms INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breaker_id UUID NOT NULL REFERENCES agent_circuit_breakers(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  total_calls INT NOT NULL DEFAULT 0,
  successful_calls INT NOT NULL DEFAULT 0,
  failed_calls INT NOT NULL DEFAULT 0,
  rejected_calls INT NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  p99_latency_ms NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circuit_breakers_agent ON agent_circuit_breakers(agent_id);
CREATE INDEX idx_circuit_breakers_target ON agent_circuit_breakers(target_agent_id);
CREATE INDEX idx_circuit_breakers_state ON agent_circuit_breakers(state);
CREATE INDEX idx_circuit_trips_breaker ON circuit_breaker_trips(breaker_id);
CREATE INDEX idx_circuit_trips_type ON circuit_breaker_trips(trip_type);
CREATE INDEX idx_circuit_metrics_breaker ON circuit_breaker_metrics(breaker_id);
