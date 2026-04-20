-- Batch 242: Endpoint Monitor
-- Endpoint health checks, uptime monitoring, alerting

CREATE TABLE IF NOT EXISTS agent_monitored_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  endpoint_url TEXT NOT NULL,
  endpoint_name TEXT NOT NULL,
  check_interval_seconds INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  expected_status INTEGER DEFAULT 200,
  expected_body_contains TEXT,
  method TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET', 'POST', 'HEAD')),
  headers JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_endpoint_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_monitored_endpoints(id),
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded', 'timeout', 'error')),
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_endpoint_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_monitored_endpoints(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('down', 'degraded', 'timeout', 'ssl_expiry', 'response_change', 'recovered')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitored_endpoints_agent ON agent_monitored_endpoints(agent_id);
CREATE INDEX idx_monitored_endpoints_active ON agent_monitored_endpoints(active);
CREATE INDEX idx_endpoint_checks_endpoint ON agent_endpoint_checks(endpoint_id);
CREATE INDEX idx_endpoint_checks_status ON agent_endpoint_checks(status);
CREATE INDEX idx_endpoint_checks_at ON agent_endpoint_checks(checked_at);
CREATE INDEX idx_endpoint_alerts_endpoint ON agent_endpoint_alerts(endpoint_id);
CREATE INDEX idx_endpoint_alerts_type ON agent_endpoint_alerts(alert_type);
CREATE INDEX idx_endpoint_alerts_severity ON agent_endpoint_alerts(severity);
