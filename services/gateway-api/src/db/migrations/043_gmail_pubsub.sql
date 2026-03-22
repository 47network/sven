-- Migration 043: Gmail Pub/Sub email triggers

CREATE TABLE IF NOT EXISTS email_subscriptions (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    pubsub_subscription TEXT NOT NULL UNIQUE,
    handler            TEXT NOT NULL,
    config             JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    last_received      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_subscriptions_enabled
  ON email_subscriptions(enabled);

CREATE TABLE IF NOT EXISTS email_events (
    id              TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES email_subscriptions(id) ON DELETE CASCADE,
    status          TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_sub_created
  ON email_events(subscription_id, created_at DESC);
