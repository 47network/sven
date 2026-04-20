-- Batch 437: Circuit Breaker Agent
CREATE TABLE IF NOT EXISTS agent_circuit_breaker_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  failure_threshold INTEGER NOT NULL DEFAULT 5,
  reset_timeout_ms INTEGER NOT NULL DEFAULT 60000,
  half_open_max_calls INTEGER NOT NULL DEFAULT 3,
  monitoring_window_ms INTEGER NOT NULL DEFAULT 60000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_circuit_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_circuit_breaker_agent_configs(id),
  service_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_circuit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breaker_id UUID NOT NULL REFERENCES agent_circuit_breakers(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('trip','reset','half_open','success','failure')),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_circuit_breaker_agent_configs_agent ON agent_circuit_breaker_agent_configs(agent_id);
CREATE INDEX idx_agent_circuit_breakers_config ON agent_circuit_breakers(config_id);
CREATE INDEX idx_agent_circuit_events_breaker ON agent_circuit_events(breaker_id);
