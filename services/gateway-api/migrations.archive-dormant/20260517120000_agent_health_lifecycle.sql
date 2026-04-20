-- Batch 44 — Agent Health & Lifecycle
-- Self-healing, uptime monitoring, lifecycle management

CREATE TABLE IF NOT EXISTS agent_health_checks (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  check_type    TEXT NOT NULL CHECK (check_type IN (
                  'heartbeat','deep_check','dependency_check',
                  'performance_check','memory_check','task_throughput')),
  status        TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN (
                  'healthy','degraded','critical','offline','recovering','unknown')),
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN (
                  'info','warning','error','critical')),
  response_ms   INTEGER,
  details       JSONB DEFAULT '{}',
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_lifecycle_events (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  from_state    TEXT,
  to_state      TEXT NOT NULL CHECK (to_state IN (
                  'born','initializing','active','idle','hibernating',
                  'degraded','recovering','retiring','retired','terminated')),
  reason        TEXT,
  triggered_by  TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN (
                  'healthy','degraded','critical','offline','recovering','unknown')),
  cpu_percent   REAL,
  memory_mb     REAL,
  active_tasks  INTEGER DEFAULT 0,
  uptime_s      INTEGER DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  pinged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_recovery_actions (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  health_check_id TEXT REFERENCES agent_health_checks(id),
  action_type   TEXT NOT NULL CHECK (action_type IN (
                  'restart','reload_config','clear_cache','reassign_tasks',
                  'scale_resources','rollback','escalate','quarantine')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                  'pending','in_progress','completed','failed','skipped')),
  result        JSONB DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_sla_configs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL UNIQUE,
  target_uptime REAL NOT NULL DEFAULT 99.5,
  max_response_ms INTEGER NOT NULL DEFAULT 5000,
  max_missed_heartbeats INTEGER NOT NULL DEFAULT 3,
  check_interval_ms INTEGER NOT NULL DEFAULT 30000,
  auto_recover  BOOLEAN NOT NULL DEFAULT TRUE,
  escalation_contacts JSONB DEFAULT '[]',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_agent ON agent_health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON agent_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON agent_health_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_type ON agent_health_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_agent ON agent_lifecycle_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_to_state ON agent_lifecycle_events(to_state);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_created ON agent_lifecycle_events(created_at);
CREATE INDEX IF NOT EXISTS idx_heartbeats_agent ON agent_heartbeats(agent_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_pinged ON agent_heartbeats(pinged_at);
CREATE INDEX IF NOT EXISTS idx_heartbeats_status ON agent_heartbeats(status);
CREATE INDEX IF NOT EXISTS idx_recovery_agent ON agent_recovery_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON agent_recovery_actions(status);
CREATE INDEX IF NOT EXISTS idx_recovery_action_type ON agent_recovery_actions(action_type);
