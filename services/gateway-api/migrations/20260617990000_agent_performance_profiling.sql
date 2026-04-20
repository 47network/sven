-- Batch 162: Agent Performance Profiling
-- CPU/memory profiling, bottleneck detection, optimization recommendations

CREATE TABLE IF NOT EXISTS agent_perf_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  agent_id        UUID NOT NULL,
  profile_type    TEXT NOT NULL CHECK (profile_type IN ('cpu','memory','io','network','latency','throughput')),
  duration_ms     INT NOT NULL,
  sample_count    INT NOT NULL DEFAULT 0,
  hot_spots       JSONB NOT NULL DEFAULT '[]',
  flamegraph_url  TEXT,
  peak_value      NUMERIC(18,6),
  avg_value       NUMERIC(18,6),
  p99_value       NUMERIC(18,6),
  metadata        JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_perf_bottlenecks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES agent_perf_profiles(id),
  bottleneck_type TEXT NOT NULL CHECK (bottleneck_type IN ('cpu_bound','memory_leak','io_wait','lock_contention','network_latency','gc_pressure','queue_backup')),
  severity        TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  component       TEXT NOT NULL,
  description     TEXT NOT NULL,
  impact_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  suggestion      TEXT,
  auto_fixable    BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_perf_baselines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  metric_name     TEXT NOT NULL,
  baseline_value  NUMERIC(18,6) NOT NULL,
  current_value   NUMERIC(18,6),
  deviation_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving','stable','degrading','critical')),
  window_hours    INT NOT NULL DEFAULT 24,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_profiles_agent ON agent_perf_profiles(agent_id);
CREATE INDEX idx_perf_bottlenecks_profile ON agent_perf_bottlenecks(profile_id);
CREATE INDEX idx_perf_baselines_agent ON agent_perf_baselines(agent_id);
