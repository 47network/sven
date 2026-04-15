-- Migration: 001_create_marketing_intel_tables.sql
-- Service:   @sven/marketing-intel-service
-- Created:   2026-04-15
-- Purpose:   Postgres schema for marketing intelligence service

BEGIN;

-- ── Competitors & Signals ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_competitors (
  id            UUID PRIMARY KEY,
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  website       TEXT,
  linkedin_url  TEXT,
  github_org    TEXT,
  industry      TEXT,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  profile       JSONB NOT NULL DEFAULT '{}',
  tracked_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_competitors_org ON marketing_competitors (org_id, is_active);

CREATE TABLE IF NOT EXISTS marketing_signals (
  id            UUID PRIMARY KEY,
  org_id        TEXT NOT NULL,
  competitor_id UUID NOT NULL REFERENCES marketing_competitors(id) ON DELETE CASCADE,
  signal_type   TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT,
  source_url    TEXT,
  analysis      TEXT,
  impact_level  SMALLINT NOT NULL DEFAULT 2 CHECK (impact_level BETWEEN 1 AND 5),
  raw_data      JSONB,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_signals_competitor ON marketing_signals (competitor_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_signals_org ON marketing_signals (org_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS marketing_reports (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  report_type     TEXT NOT NULL,
  title           TEXT NOT NULL,
  content_md      TEXT NOT NULL,
  competitor_ids  UUID[] NOT NULL DEFAULT '{}',
  key_findings    JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_reports_org ON marketing_reports (org_id, created_at DESC);

-- ── Brand Voice ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_brand_checks (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  content_snippet TEXT NOT NULL,
  score           SMALLINT NOT NULL,
  grade           CHAR(1) NOT NULL,
  violations      JSONB NOT NULL DEFAULT '[]',
  suggestions     JSONB NOT NULL DEFAULT '[]',
  tone_analysis   JSONB NOT NULL DEFAULT '[]',
  key_msg_hits    JSONB NOT NULL DEFAULT '[]',
  profile_name    TEXT NOT NULL DEFAULT '47Network',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_brand_checks_org ON marketing_brand_checks (org_id, created_at DESC);

-- ── Content ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_content (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  brief_id        UUID,
  content_type    TEXT NOT NULL,
  channel         TEXT NOT NULL,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  body            TEXT,
  brief           JSONB,
  brand_score     SMALLINT,
  performance     JSONB,
  scheduled_for   TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_content_org ON marketing_content (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_content_channel ON marketing_content (channel, status);

-- ── Campaigns ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'planning',
  goals           JSONB NOT NULL DEFAULT '[]',
  budget          JSONB,
  channels        TEXT[] NOT NULL DEFAULT '{}',
  target_audience TEXT,
  score           SMALLINT,
  performance     JSONB,
  content_ids     UUID[] NOT NULL DEFAULT '{}',
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_org ON marketing_campaigns (org_id, status, created_at DESC);

-- ── Communication Coaching ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_coaching_sessions (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  scenario_id     TEXT NOT NULL,
  scenario_title  TEXT NOT NULL,
  turns           JSONB NOT NULL DEFAULT '[]',
  debrief         JSONB,
  overall_score   SMALLINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_coaching_org ON marketing_coaching_sessions (org_id, user_id, created_at DESC);

-- ── Analytics ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_analytics (
  id              UUID PRIMARY KEY,
  org_id          TEXT NOT NULL,
  period          TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  channels        JSONB NOT NULL DEFAULT '{}',
  totals          JSONB NOT NULL DEFAULT '{}',
  trends          JSONB NOT NULL DEFAULT '{}',
  top_content     JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  report_md       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_analytics_org ON marketing_analytics (org_id, period, start_date DESC);

COMMIT;
