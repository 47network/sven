-- Batch 325: Event Correlator - Agent event correlation and pattern detection
CREATE TABLE IF NOT EXISTS agent_event_correlator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  correlation_window_seconds INTEGER NOT NULL DEFAULT 300,
  min_confidence DECIMAL(5,4) NOT NULL DEFAULT 0.7,
  max_patterns INTEGER NOT NULL DEFAULT 100,
  auto_learn BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_correlation_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_event_correlator_configs(id),
  pattern_name VARCHAR(255) NOT NULL,
  event_sequence JSONB NOT NULL,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  root_cause TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_correlation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES agent_correlation_patterns(id),
  matched_events JSONB NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_event_correlator_configs_agent ON agent_event_correlator_configs(agent_id);
CREATE INDEX idx_correlation_patterns_config ON agent_correlation_patterns(config_id);
CREATE INDEX idx_correlation_incidents_pattern ON agent_correlation_incidents(pattern_id);
