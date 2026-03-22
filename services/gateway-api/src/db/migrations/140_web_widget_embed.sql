-- Migration 140: Embeddable web widget configuration + instance keys (D7)

CREATE TABLE IF NOT EXISTS web_widget_settings (
  organization_id   TEXT PRIMARY KEY,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  endpoint_url      TEXT NOT NULL DEFAULT '',
  title             TEXT NOT NULL DEFAULT 'Sven',
  avatar_url        TEXT,
  position          TEXT NOT NULL DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left')),
  primary_color     TEXT NOT NULL DEFAULT '#2563eb',
  background_color  TEXT NOT NULL DEFAULT '#0f172a',
  welcome_text      TEXT NOT NULL DEFAULT 'Hi, how can I help?',
  updated_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS web_widget_instances (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  name              TEXT NOT NULL,
  api_key_hash      TEXT NOT NULL UNIQUE,
  api_key_last4     TEXT NOT NULL,
  rate_limit_rpm    INTEGER NOT NULL DEFAULT 60 CHECK (rate_limit_rpm BETWEEN 1 AND 2000),
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_widget_instances_org_enabled
  ON web_widget_instances (organization_id, enabled, created_at DESC);
