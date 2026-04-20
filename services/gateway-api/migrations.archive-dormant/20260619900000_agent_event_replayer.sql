-- Batch 353: Event Replayer — replay and audit event streams
CREATE TABLE IF NOT EXISTS agent_event_replayer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_stream TEXT NOT NULL,
  replay_mode TEXT NOT NULL DEFAULT 'sequential' CHECK (replay_mode IN ('sequential','parallel','time_scaled','filtered')),
  speed_factor NUMERIC(6,2) NOT NULL DEFAULT 1.0,
  filter_pattern JSONB DEFAULT '{}',
  start_from TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  max_events INTEGER,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','replaying','paused','completed','failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_replayer_configs_agent ON agent_event_replayer_configs(agent_id);

CREATE TABLE IF NOT EXISTS agent_replay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_event_replayer_configs(id),
  session_status TEXT NOT NULL DEFAULT 'pending' CHECK (session_status IN ('pending','running','paused','completed','failed','cancelled')),
  events_total INTEGER NOT NULL DEFAULT 0,
  events_replayed INTEGER NOT NULL DEFAULT 0,
  events_skipped INTEGER NOT NULL DEFAULT 0,
  events_failed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_log JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_replay_sessions_config ON agent_replay_sessions(config_id);
CREATE INDEX idx_replay_sessions_status ON agent_replay_sessions(session_status);

CREATE TABLE IF NOT EXISTS agent_replay_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_replay_sessions(id),
  event_offset BIGINT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  checkpoint_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_replay_checkpoints_session ON agent_replay_checkpoints(session_id);
