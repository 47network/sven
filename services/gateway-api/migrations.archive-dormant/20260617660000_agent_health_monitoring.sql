-- Batch 129: Agent Health Monitoring
-- Service health checks, uptime tracking, and SLA monitoring

CREATE TABLE IF NOT EXISTS agent_health_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  check_name      TEXT NOT NULL,
  check_type      TEXT NOT NULL CHECK (check_type IN ('http','tcp','dns','grpc','custom')),
  target_url      TEXT NOT NULL,
  interval_secs   INTEGER NOT NULL DEFAULT 60 CHECK (interval_secs >= 10),
  timeout_ms      INTEGER NOT NULL DEFAULT 5000,
  expected_status INTEGER DEFAULT 200,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_status     TEXT CHECK (last_status IN ('healthy','degraded','unhealthy','unknown')),
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, check_name)
);

CREATE TABLE IF NOT EXISTS agent_health_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id        UUID NOT NULL REFERENCES agent_health_checks(id),
  status          TEXT NOT NULL CHECK (status IN ('healthy','degraded','unhealthy')),
  response_ms     INTEGER,
  status_code     INTEGER,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_uptime_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id        UUID NOT NULL REFERENCES agent_health_checks(id),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  uptime_pct      NUMERIC(6,3) NOT NULL CHECK (uptime_pct >= 0 AND uptime_pct <= 100),
  total_checks    INTEGER NOT NULL DEFAULT 0,
  failed_checks   INTEGER NOT NULL DEFAULT 0,
  avg_response_ms INTEGER,
  sla_target_pct  NUMERIC(5,2) DEFAULT 99.90,
  UNIQUE(check_id, period_start)
);

CREATE INDEX idx_health_checks_agent ON agent_health_checks(agent_id);
CREATE INDEX idx_health_events_check ON agent_health_events(check_id);
CREATE INDEX idx_uptime_records_check ON agent_uptime_records(check_id);
