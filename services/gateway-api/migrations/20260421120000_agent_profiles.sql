-- Migration: Agent Profiles table
--
-- Persists agent identity, archetype, reputation, and seller configuration.
-- Each agent_id maps 1:1 to an automaton or seller-agent. The archetype
-- determines default skills, Eidolon citizen role, and lifecycle thresholds.
--
-- Rollback:
--   DROP TABLE IF EXISTS agent_profiles;

BEGIN;

-- ─── Agent Profiles table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_profiles (
  id                  TEXT PRIMARY KEY,
  agent_id            TEXT UNIQUE NOT NULL,
  org_id              TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  bio                 TEXT,
  avatar_url          TEXT,
  archetype           TEXT NOT NULL DEFAULT 'custom',
  specializations     JSONB NOT NULL DEFAULT '[]'::jsonb,
  reputation          JSONB NOT NULL DEFAULT '{"rating":0,"reviewCount":0,"totalSales":0}'::jsonb,
  personality_mode    TEXT NOT NULL DEFAULT 'professional',
  status              TEXT NOT NULL DEFAULT 'active',
  payout_account_id   TEXT,
  commission_pct      NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT agent_profiles_status_chk
    CHECK (status IN ('active', 'suspended', 'retired')),

  CONSTRAINT agent_profiles_archetype_chk
    CHECK (archetype IN (
      'seller', 'translator', 'writer', 'scout',
      'analyst', 'operator', 'accountant',
      'marketer', 'researcher', 'legal',
      'designer', 'support', 'strategist',
      'recruiter', 'custom'
    )),

  CONSTRAINT agent_profiles_commission_chk
    CHECK (commission_pct >= 0 AND commission_pct <= 100)
);

-- Fast lookup by org + status (most common admin query)
CREATE INDEX IF NOT EXISTS idx_agent_profiles_org_status
  ON agent_profiles (org_id, status);

-- Filter agents by archetype
CREATE INDEX IF NOT EXISTS idx_agent_profiles_archetype
  ON agent_profiles (archetype)
  WHERE status = 'active';

-- Unique agent_id already has implicit unique index, but explicit for clarity
CREATE INDEX IF NOT EXISTS idx_agent_profiles_agent_id
  ON agent_profiles (agent_id);

COMMIT;
