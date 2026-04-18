-- Batch 45 — Agent Task Queue & Scheduling
-- Priority-based task queuing with automated agent assignment

CREATE TABLE IF NOT EXISTS task_queue_items (
  id              TEXT PRIMARY KEY,
  task_type       TEXT NOT NULL,
  priority        INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                    'queued', 'assigned', 'in_progress', 'completed',
                    'failed', 'cancelled', 'deferred', 'expired'
                  )),
  payload         JSONB NOT NULL DEFAULT '{}',
  result          JSONB,
  assigned_agent_id TEXT,
  required_skills TEXT[] DEFAULT '{}',
  max_retries     INTEGER NOT NULL DEFAULT 3,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_schedules (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  task_type       TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  payload_template JSONB NOT NULL DEFAULT '{}',
  priority        INTEGER NOT NULL DEFAULT 50,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  run_count       INTEGER NOT NULL DEFAULT 0,
  max_runs        INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id              TEXT PRIMARY KEY,
  queue_item_id   TEXT NOT NULL REFERENCES task_queue_items(id),
  agent_id        TEXT NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  reason          TEXT,
  score           REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES task_queue_items(id),
  depends_on_id   TEXT NOT NULL REFERENCES task_queue_items(id),
  dep_type        TEXT NOT NULL DEFAULT 'blocks' CHECK (dep_type IN (
                    'blocks', 'suggests', 'triggers'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_execution_logs (
  id              TEXT PRIMARY KEY,
  queue_item_id   TEXT NOT NULL REFERENCES task_queue_items(id),
  agent_id        TEXT,
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'queued', 'assigned', 'accepted', 'rejected',
                    'started', 'progress', 'completed', 'failed',
                    'retried', 'cancelled', 'deferred', 'expired'
                  )),
  details         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_queue_items_status ON task_queue_items(status);
CREATE INDEX IF NOT EXISTS idx_queue_items_priority ON task_queue_items(priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_items_type ON task_queue_items(task_type);
CREATE INDEX IF NOT EXISTS idx_queue_items_agent ON task_queue_items(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_scheduled ON task_queue_items(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_items_deadline ON task_queue_items(deadline_at);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON task_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON task_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_assignments_item ON task_assignments(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_assignments_agent ON task_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_dep ON task_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_exec_logs_item ON task_execution_logs(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_exec_logs_agent ON task_execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_exec_logs_type ON task_execution_logs(event_type);
