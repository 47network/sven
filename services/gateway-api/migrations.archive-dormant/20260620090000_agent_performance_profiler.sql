CREATE TABLE IF NOT EXISTS agent_performance_profiler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  profiling_mode TEXT NOT NULL DEFAULT 'sampling',
  sample_rate NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  trace_enabled BOOLEAN NOT NULL DEFAULT true,
  flame_graph_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_profiling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_performance_profiler_configs(id),
  agent_id UUID NOT NULL,
  target_service TEXT NOT NULL,
  profiling_type TEXT NOT NULL DEFAULT 'cpu',
  duration_seconds INTEGER NOT NULL,
  samples_collected INTEGER NOT NULL DEFAULT 0,
  hotspots_found INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_performance_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_profiling_sessions(id),
  function_name TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  self_time_ms NUMERIC NOT NULL,
  total_time_ms NUMERIC NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  memory_bytes BIGINT,
  category TEXT NOT NULL DEFAULT 'cpu',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiling_sessions_agent ON agent_profiling_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_profiling_sessions_status ON agent_profiling_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hotspots_session ON agent_performance_hotspots(session_id);
