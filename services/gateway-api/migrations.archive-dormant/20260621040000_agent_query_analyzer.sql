CREATE TABLE IF NOT EXISTS agent_query_analyzer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  monitored_databases JSONB NOT NULL DEFAULT '[]',
  slow_query_threshold_ms INTEGER NOT NULL DEFAULT 1000,
  analysis_depth TEXT NOT NULL DEFAULT 'standard',
  plan_capture BOOLEAN NOT NULL DEFAULT true,
  recommendation_mode TEXT NOT NULL DEFAULT 'suggest',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_query_analyzer_configs_agent ON agent_query_analyzer_configs(agent_id);
CREATE INDEX idx_agent_query_analyzer_configs_enabled ON agent_query_analyzer_configs(enabled);
