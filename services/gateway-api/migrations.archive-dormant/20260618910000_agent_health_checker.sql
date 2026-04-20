-- Batch 254: Health Checker — endpoint health monitoring
CREATE TABLE IF NOT EXISTS agent_health_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_name VARCHAR(255) NOT NULL,
  target_url VARCHAR(1000) NOT NULL,
  check_type VARCHAR(50) NOT NULL DEFAULT 'http',
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  expected_status INTEGER DEFAULT 200,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_health_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES agent_health_targets(id),
  status_code INTEGER,
  response_time_ms INTEGER,
  healthy BOOLEAN NOT NULL,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_health_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES agent_health_targets(id),
  incident_type VARCHAR(50) NOT NULL DEFAULT 'downtime',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);
CREATE INDEX idx_health_targets_agent ON agent_health_targets(agent_id);
CREATE INDEX idx_health_results_target ON agent_health_results(target_id);
CREATE INDEX idx_health_incidents_target ON agent_health_incidents(target_id);
