CREATE TABLE IF NOT EXISTS agent_container_profiler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  profiling_interval_seconds INTEGER NOT NULL DEFAULT 60,
  metrics_retention_days INTEGER NOT NULL DEFAULT 30,
  cpu_threshold_percent NUMERIC NOT NULL DEFAULT 80,
  memory_threshold_percent NUMERIC NOT NULL DEFAULT 85,
  auto_scale_on_threshold BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_container_profiler_agent ON agent_container_profiler_configs(agent_id);
CREATE INDEX idx_container_profiler_enabled ON agent_container_profiler_configs(enabled);
