-- Batch 175: Agent Log Correlation
-- Correlates logs across services to identify patterns,
-- build incident timelines, and detect cascading failures

CREATE TABLE IF NOT EXISTS agent_log_correlation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('regex','keyword','structured','ml_model','anomaly_detection','sequence')),
  pattern_config JSONB NOT NULL,
  severity_threshold TEXT NOT NULL DEFAULT 'warning' CHECK (severity_threshold IN ('debug','info','warning','error','critical','fatal')),
  correlation_window_ms INTEGER NOT NULL DEFAULT 60000,
  min_occurrences INTEGER NOT NULL DEFAULT 3,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_log_correlation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES agent_log_correlation_rules(id),
  incident_type TEXT NOT NULL CHECK (incident_type IN ('cascade_failure','error_storm','latency_spike','resource_exhaustion','security_event','data_anomaly')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  correlated_entries INTEGER NOT NULL DEFAULT 0,
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  root_cause TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','mitigating','resolved','closed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_log_correlation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES agent_log_correlation_incidents(id),
  source_service TEXT NOT NULL,
  log_level TEXT NOT NULL,
  message TEXT NOT NULL,
  trace_id TEXT,
  span_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  extracted_fields JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_log_rules_agent ON agent_log_correlation_rules(agent_id);
CREATE INDEX idx_log_incidents_status ON agent_log_correlation_incidents(status);
CREATE INDEX idx_log_incidents_severity ON agent_log_correlation_incidents(severity);
CREATE INDEX idx_log_entries_incident ON agent_log_correlation_entries(incident_id);
CREATE INDEX idx_log_entries_trace ON agent_log_correlation_entries(trace_id);
