-- Batch 68: Agent Localization & i18n
-- Multi-language support, translation management, locale-aware content delivery

CREATE TABLE IF NOT EXISTS locale_configs (
  id              TEXT PRIMARY KEY,
  locale_code     TEXT NOT NULL UNIQUE,
  language        TEXT NOT NULL,
  region          TEXT,
  direction       TEXT NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr','rtl')),
  fallback_locale TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS translation_keys (
  id              TEXT PRIMARY KEY,
  namespace       TEXT NOT NULL DEFAULT 'common',
  key_path        TEXT NOT NULL,
  description     TEXT,
  context         TEXT,
  max_length      INTEGER,
  placeholders    JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(namespace, key_path)
);

CREATE TABLE IF NOT EXISTS translation_values (
  id              TEXT PRIMARY KEY,
  key_id          TEXT NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  locale_code     TEXT NOT NULL,
  value           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','published','rejected')),
  translated_by   TEXT,
  reviewed_by     TEXT,
  quality_score   REAL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(key_id, locale_code)
);

CREATE TABLE IF NOT EXISTS locale_content (
  id              TEXT PRIMARY KEY,
  content_type    TEXT NOT NULL CHECK (content_type IN ('skill_description','marketplace_listing','ui_element','email_template','notification','documentation')),
  content_id      TEXT NOT NULL,
  locale_code     TEXT NOT NULL,
  title           TEXT,
  body            TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','published')),
  translated_by   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_type, content_id, locale_code)
);

CREATE TABLE IF NOT EXISTS locale_detection_logs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  user_id         TEXT,
  detected_locale TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('header','cookie','url','geo','preference','default')),
  confidence      REAL DEFAULT 1.0,
  final_locale    TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_locale_configs_code ON locale_configs(locale_code);
CREATE INDEX IF NOT EXISTS idx_locale_configs_language ON locale_configs(language);
CREATE INDEX IF NOT EXISTS idx_locale_configs_enabled ON locale_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_translation_keys_namespace ON translation_keys(namespace);
CREATE INDEX IF NOT EXISTS idx_translation_keys_path ON translation_keys(key_path);
CREATE INDEX IF NOT EXISTS idx_translation_keys_ns_path ON translation_keys(namespace, key_path);
CREATE INDEX IF NOT EXISTS idx_translation_values_key ON translation_values(key_id);
CREATE INDEX IF NOT EXISTS idx_translation_values_locale ON translation_values(locale_code);
CREATE INDEX IF NOT EXISTS idx_translation_values_status ON translation_values(status);
CREATE INDEX IF NOT EXISTS idx_translation_values_quality ON translation_values(quality_score);
CREATE INDEX IF NOT EXISTS idx_translation_values_key_locale ON translation_values(key_id, locale_code);
CREATE INDEX IF NOT EXISTS idx_locale_content_type ON locale_content(content_type);
CREATE INDEX IF NOT EXISTS idx_locale_content_id ON locale_content(content_id);
CREATE INDEX IF NOT EXISTS idx_locale_content_locale ON locale_content(locale_code);
CREATE INDEX IF NOT EXISTS idx_locale_content_status ON locale_content(status);
CREATE INDEX IF NOT EXISTS idx_locale_content_composite ON locale_content(content_type, content_id, locale_code);
CREATE INDEX IF NOT EXISTS idx_locale_detection_agent ON locale_detection_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_locale_detection_locale ON locale_detection_logs(detected_locale);
CREATE INDEX IF NOT EXISTS idx_locale_detection_source ON locale_detection_logs(source);
CREATE INDEX IF NOT EXISTS idx_locale_detection_created ON locale_detection_logs(created_at);
