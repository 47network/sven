CREATE TABLE IF NOT EXISTS agent_log_analyzer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  log_sources JSONB NOT NULL DEFAULT '[]',
  pattern_detection BOOLEAN NOT NULL DEFAULT true,
  anomaly_sensitivity NUMERIC(3,2) NOT NULL DEFAULT 0.80,
  retention_days INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_log_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_analyzer_configs(id),
  agent_id UUID NOT NULL,
  source TEXT NOT NULL,
  time_range_start TIMESTAMPTZ NOT NULL,
  time_range_end TIMESTAMPTZ NOT NULL,
  total_entries INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  patterns_found INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'analyzing',
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_log_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES agent_log_analyses(id),
  pattern_type TEXT NOT NULL,
  pattern_signature TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'info',
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  sample_entries JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_log_analyses_agent ON agent_log_analyses(agent_id);
CREATE INDEX IF NOT EXISTS idx_log_analyses_status ON agent_log_analyses(status);
CREATE INDEX IF NOT EXISTS idx_log_patterns_analysis ON agent_log_patterns(analysis_id);
