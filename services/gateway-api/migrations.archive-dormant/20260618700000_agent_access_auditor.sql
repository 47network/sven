-- Batch 233: Access Auditor
-- Audits and monitors access patterns across agent systems

CREATE TABLE IF NOT EXISTS agent_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resource_type VARCHAR(128) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL CHECK (action IN ('read', 'write', 'delete', 'execute', 'admin', 'export')),
  outcome VARCHAR(32) NOT NULL CHECK (outcome IN ('allowed', 'denied', 'escalated', 'flagged')),
  source_ip VARCHAR(64),
  user_agent TEXT,
  context JSONB DEFAULT '{}',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_access_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(64) NOT NULL CHECK (pattern_type IN ('normal', 'anomalous', 'suspicious', 'malicious')),
  frequency INTEGER NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_access_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pattern_id UUID REFERENCES agent_access_patterns(id),
  alert_type VARCHAR(64) NOT NULL CHECK (alert_type IN ('unusual_access', 'privilege_escalation', 'brute_force', 'data_exfiltration', 'off_hours')),
  severity VARCHAR(32) NOT NULL DEFAULT 'medium',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_logs_agent ON agent_access_logs(agent_id);
CREATE INDEX idx_access_logs_resource ON agent_access_logs(resource_type, resource_id);
CREATE INDEX idx_access_patterns_agent ON agent_access_patterns(agent_id);
CREATE INDEX idx_access_alerts_agent ON agent_access_alerts(agent_id);
