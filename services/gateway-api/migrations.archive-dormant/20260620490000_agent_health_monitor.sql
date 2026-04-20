-- Batch 412: Health Monitor
-- Monitors agent and service health with checks, alerts, and incident tracking

CREATE TABLE IF NOT EXISTS agent_health_monitor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  check_interval_seconds INTEGER NOT NULL DEFAULT 60,
  alert_cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  max_incidents INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_health_monitor_configs(id),
  name TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('http', 'tcp', 'dns', 'script', 'heartbeat', 'metric_threshold')),
  target TEXT NOT NULL,
  expected_status TEXT NOT NULL DEFAULT 'healthy',
  current_status TEXT NOT NULL DEFAULT 'unknown' CHECK (current_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  last_check_at TIMESTAMPTZ,
  last_healthy_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  config_params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_health_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES agent_health_checks(id),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'fatal')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title TEXT NOT NULL,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_health_checks_config ON agent_health_checks(config_id);
CREATE INDEX idx_agent_health_checks_status ON agent_health_checks(current_status);
CREATE INDEX idx_agent_health_incidents_check ON agent_health_incidents(check_id);
CREATE INDEX idx_agent_health_incidents_status ON agent_health_incidents(status);
