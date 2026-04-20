-- Batch 63: Agent Versioning & Rollback
-- Tracks agent versions, snapshots, rollback history, deployment slots, and diff records

CREATE TABLE IF NOT EXISTS agent_versions (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  version_tag     TEXT NOT NULL,
  major           INTEGER NOT NULL DEFAULT 1,
  minor           INTEGER NOT NULL DEFAULT 0,
  patch           INTEGER NOT NULL DEFAULT 0,
  changelog       TEXT,
  snapshot_data   JSONB NOT NULL DEFAULT '{}',
  config_hash     TEXT,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  is_stable       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_at     TIMESTAMPTZ,
  UNIQUE(agent_id, version_tag)
);

CREATE TABLE IF NOT EXISTS agent_snapshots (
  id              TEXT PRIMARY KEY,
  version_id      TEXT NOT NULL REFERENCES agent_versions(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  snapshot_type   TEXT NOT NULL CHECK (snapshot_type IN ('full', 'config', 'skills', 'memory', 'state')),
  data            JSONB NOT NULL DEFAULT '{}',
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  compressed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_rollbacks (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  from_version_id TEXT NOT NULL REFERENCES agent_versions(id),
  to_version_id   TEXT NOT NULL REFERENCES agent_versions(id),
  reason          TEXT,
  rollback_type   TEXT NOT NULL CHECK (rollback_type IN ('manual', 'automatic', 'health_check', 'performance', 'error_rate')),
  status          TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_deployment_slots (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  slot_name       TEXT NOT NULL CHECK (slot_name IN ('production', 'staging', 'canary', 'preview', 'rollback')),
  version_id      TEXT REFERENCES agent_versions(id),
  traffic_pct     INTEGER NOT NULL DEFAULT 100 CHECK (traffic_pct >= 0 AND traffic_pct <= 100),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  promoted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, slot_name)
);

CREATE TABLE IF NOT EXISTS agent_version_diffs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  from_version_id TEXT NOT NULL REFERENCES agent_versions(id),
  to_version_id   TEXT NOT NULL REFERENCES agent_versions(id),
  diff_type       TEXT NOT NULL CHECK (diff_type IN ('config', 'skills', 'memory', 'behavior', 'full')),
  additions       JSONB NOT NULL DEFAULT '[]',
  removals        JSONB NOT NULL DEFAULT '[]',
  modifications   JSONB NOT NULL DEFAULT '[]',
  summary         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_current ON agent_versions(agent_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_versions_tag ON agent_versions(agent_id, version_tag);
CREATE INDEX IF NOT EXISTS idx_agent_versions_created ON agent_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_snapshots_version ON agent_snapshots(version_id);
CREATE INDEX IF NOT EXISTS idx_agent_snapshots_agent ON agent_snapshots(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_snapshots_type ON agent_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_agent_snapshots_expires ON agent_snapshots(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_rollbacks_agent ON agent_rollbacks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_rollbacks_status ON agent_rollbacks(status);
CREATE INDEX IF NOT EXISTS idx_agent_rollbacks_from ON agent_rollbacks(from_version_id);
CREATE INDEX IF NOT EXISTS idx_agent_rollbacks_to ON agent_rollbacks(to_version_id);
CREATE INDEX IF NOT EXISTS idx_agent_rollbacks_created ON agent_rollbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_slots_agent ON agent_deployment_slots(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_slots_version ON agent_deployment_slots(version_id);
CREATE INDEX IF NOT EXISTS idx_agent_slots_active ON agent_deployment_slots(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_diffs_agent ON agent_version_diffs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_diffs_from ON agent_version_diffs(from_version_id);
CREATE INDEX IF NOT EXISTS idx_agent_diffs_to ON agent_version_diffs(to_version_id);
