-- Batch 358: Session Recorder
-- Records and replays agent interaction sessions for debugging and training

CREATE TABLE IF NOT EXISTS agent_session_recorder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  recording_mode VARCHAR(32) NOT NULL DEFAULT 'passive',
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_session_duration_ms BIGINT NOT NULL DEFAULT 3600000,
  capture_inputs BOOLEAN NOT NULL DEFAULT true,
  capture_outputs BOOLEAN NOT NULL DEFAULT true,
  capture_metadata BOOLEAN NOT NULL DEFAULT true,
  storage_backend VARCHAR(32) NOT NULL DEFAULT 'postgresql',
  compression_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_recorded_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_session_recorder_configs(id),
  agent_id UUID NOT NULL,
  session_type VARCHAR(32) NOT NULL DEFAULT 'interaction',
  status VARCHAR(32) NOT NULL DEFAULT 'recording',
  event_count INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_recorded_sessions(id),
  event_type VARCHAR(64) NOT NULL,
  sequence_number INTEGER NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_recorder_configs_agent ON agent_session_recorder_configs(agent_id);
CREATE INDEX idx_recorded_sessions_config ON agent_recorded_sessions(config_id);
CREATE INDEX idx_recorded_sessions_agent ON agent_recorded_sessions(agent_id);
CREATE INDEX idx_session_events_session ON agent_session_events(session_id);
CREATE INDEX idx_session_events_sequence ON agent_session_events(session_id, sequence_number);
