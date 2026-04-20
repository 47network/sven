-- Batch 89: Agent Event Sourcing
-- Event store, aggregates, projections, snapshots, and replay tracking

CREATE TABLE IF NOT EXISTS event_store (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  sequence_number BIGINT NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(aggregate_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS event_aggregates (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  current_version BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted','locked')),
  last_event_at TIMESTAMPTZ,
  snapshot_version BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_projections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_aggregate_type TEXT NOT NULL,
  projection_type TEXT NOT NULL CHECK (projection_type IN ('sync','async','catch_up','live')),
  last_processed_sequence BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','rebuilding','error','stopped')),
  error_message TEXT,
  lag_events BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_snapshots (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL REFERENCES event_aggregates(id) ON DELETE CASCADE,
  aggregate_type TEXT NOT NULL,
  version BIGINT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  size_bytes BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(aggregate_id, version)
);

CREATE TABLE IF NOT EXISTS event_replay_logs (
  id TEXT PRIMARY KEY,
  projection_id TEXT NOT NULL REFERENCES event_projections(id) ON DELETE CASCADE,
  replay_type TEXT NOT NULL CHECK (replay_type IN ('full','partial','from_snapshot','selective')),
  from_sequence BIGINT NOT NULL DEFAULT 0,
  to_sequence BIGINT NOT NULL,
  events_replayed BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_es_aggregate ON event_store(aggregate_id);
CREATE INDEX idx_es_type ON event_store(aggregate_type);
CREATE INDEX idx_es_event_type ON event_store(event_type);
CREATE INDEX idx_es_sequence ON event_store(sequence_number);
CREATE INDEX idx_es_correlation ON event_store(correlation_id);
CREATE INDEX idx_es_created ON event_store(created_at DESC);
CREATE INDEX idx_ea_type ON event_aggregates(aggregate_type);
CREATE INDEX idx_ea_status ON event_aggregates(status);
CREATE INDEX idx_ea_last_event ON event_aggregates(last_event_at DESC);
CREATE INDEX idx_ea_created ON event_aggregates(created_at DESC);
CREATE INDEX idx_ep_name ON event_projections(name);
CREATE INDEX idx_ep_source ON event_projections(source_aggregate_type);
CREATE INDEX idx_ep_status ON event_projections(status);
CREATE INDEX idx_ep_type ON event_projections(projection_type);
CREATE INDEX idx_esn_aggregate ON event_snapshots(aggregate_id);
CREATE INDEX idx_esn_type ON event_snapshots(aggregate_type);
CREATE INDEX idx_esn_version ON event_snapshots(aggregate_id, version DESC);
CREATE INDEX idx_erl_projection ON event_replay_logs(projection_id);
CREATE INDEX idx_erl_status ON event_replay_logs(status);
CREATE INDEX idx_erl_created ON event_replay_logs(created_at DESC);
