-- Migration 042: Cron jobs and webhooks

CREATE TABLE IF NOT EXISTS cron_jobs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    expression  TEXT NOT NULL,
    handler     TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    last_run    TIMESTAMPTZ,
    next_run    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled_next_run
  ON cron_jobs(enabled, next_run);

CREATE TABLE IF NOT EXISTS cron_job_runs (
    id           TEXT PRIMARY KEY,
    cron_job_id  TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at  TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'running',
    error        TEXT,
    duration_ms  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_started
  ON cron_job_runs(cron_job_id, started_at DESC);

CREATE TABLE IF NOT EXISTS webhooks (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    path           TEXT NOT NULL UNIQUE,
    secret         TEXT,
    handler        TEXT NOT NULL,
    config         JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    last_received  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled
  ON webhooks(enabled);

CREATE TABLE IF NOT EXISTS webhook_events (
    id          TEXT PRIMARY KEY,
    webhook_id  TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_created
  ON webhook_events(webhook_id, created_at DESC);
