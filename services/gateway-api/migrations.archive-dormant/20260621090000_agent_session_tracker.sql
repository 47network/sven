CREATE TABLE IF NOT EXISTS agent_session_tracker_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 100,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  track_ip BOOLEAN NOT NULL DEFAULT true,
  track_user_agent BOOLEAN NOT NULL DEFAULT true,
  anomaly_detection BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_session_tracker_configs_agent ON agent_session_tracker_configs(agent_id);
CREATE INDEX idx_agent_session_tracker_configs_enabled ON agent_session_tracker_configs(enabled);
