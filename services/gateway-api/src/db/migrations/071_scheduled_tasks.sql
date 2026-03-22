-- Migration 071: User-facing scheduled tasks
-- Extends the admin-only cron_jobs with user-owned scheduled tasks
-- that execute agent instructions on a schedule.

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id      TEXT,  -- optional: which agent handles this task
    chat_id       TEXT,  -- optional: conversation context for the task
    name          TEXT NOT NULL,
    instruction   TEXT NOT NULL,  -- natural language prompt for the agent
    schedule_type TEXT NOT NULL DEFAULT 'recurring',  -- 'once' | 'recurring'
    expression    TEXT,           -- cron expression for recurring tasks
    run_at        TIMESTAMPTZ,   -- specific datetime for one-time tasks
    timezone      TEXT NOT NULL DEFAULT 'UTC',
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    last_run      TIMESTAMPTZ,
    next_run      TIMESTAMPTZ,
    run_count     INTEGER NOT NULL DEFAULT 0,
    max_runs      INTEGER,       -- NULL = unlimited
    missed_policy TEXT NOT NULL DEFAULT 'skip',  -- 'skip' | 'run_immediately'
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user
  ON scheduled_tasks(user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled_next
  ON scheduled_tasks(enabled, next_run)
  WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS scheduled_task_runs (
    id               TEXT PRIMARY KEY,
    scheduled_task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at      TIMESTAMPTZ,
    status           TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'error'
    result           TEXT,
    error            TEXT,
    duration_ms      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task_started
  ON scheduled_task_runs(scheduled_task_id, started_at DESC);
