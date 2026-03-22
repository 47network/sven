-- Migration 047: SOUL registry (personality/identity documents)

BEGIN;

CREATE TABLE IF NOT EXISTS souls_catalog (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version     TEXT NOT NULL DEFAULT '0.1.0',
  author      TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  source      TEXT NOT NULL DEFAULT 'local',
  content     TEXT NOT NULL,
  checksum    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slug, version)
);

CREATE TABLE IF NOT EXISTS souls_installed (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  soul_id       TEXT NOT NULL REFERENCES souls_catalog(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  version       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'installed'
                CHECK (status IN ('installed', 'active', 'disabled')),
  installed_by  TEXT REFERENCES users(id),
  installed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at  TIMESTAMPTZ,
  content       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_souls_installed_status ON souls_installed(status, installed_at DESC);
CREATE INDEX IF NOT EXISTS idx_souls_catalog_slug ON souls_catalog(slug, created_at DESC);

COMMIT;
