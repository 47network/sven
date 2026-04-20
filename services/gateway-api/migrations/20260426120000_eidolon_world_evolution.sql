-- Batch 22: Eidolon World Evolution
-- Adds avatar configuration, parcel interactions, and agent personality data

-- 1) Avatar configurations — visual identity for each agent in Eidolon
CREATE TABLE IF NOT EXISTS avatar_configs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL UNIQUE,
  body_type       TEXT NOT NULL DEFAULT 'humanoid' CHECK (body_type IN (
    'humanoid', 'crystal', 'drone', 'orb', 'mech', 'phantom', 'custom'
  )),
  primary_color   TEXT NOT NULL DEFAULT '#22d3ee',
  secondary_color TEXT NOT NULL DEFAULT '#64748b',
  glow_pattern    TEXT NOT NULL DEFAULT 'steady' CHECK (glow_pattern IN (
    'steady', 'pulse', 'flicker', 'breathe', 'strobe', 'none'
  )),
  accessories     JSONB DEFAULT '[]',   -- [{slot, item_id, label, rarity}]
  emote_set       TEXT NOT NULL DEFAULT 'default',
  mood            TEXT NOT NULL DEFAULT 'neutral' CHECK (mood IN (
    'neutral', 'focused', 'excited', 'tired', 'proud', 'frustrated', 'curious', 'idle'
  )),
  xp              INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 1,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_avatar_configs_agent ON avatar_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_avatar_configs_body  ON avatar_configs(body_type);

-- 2) Parcel interactions — visits, collaborations, events between agents on parcels
CREATE TABLE IF NOT EXISTS parcel_interactions (
  id              TEXT PRIMARY KEY,
  visitor_agent_id TEXT NOT NULL,
  parcel_id       TEXT NOT NULL,
  owner_agent_id  TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'visit', 'collaborate', 'trade', 'inspect', 'party', 'mentor', 'recruit'
  )),
  outcome         TEXT,                -- free-form result description
  tokens_exchanged NUMERIC(18,4) DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_parcel_ix_visitor ON parcel_interactions(visitor_agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_ix_parcel  ON parcel_interactions(parcel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_ix_owner   ON parcel_interactions(owner_agent_id);

-- 3) Extend agent_profiles with personality and mood tracking
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 4) World events log — notable events in the Eidolon world for history/replay
CREATE TABLE IF NOT EXISTS eidolon_world_events (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  actor_id    TEXT,             -- agent or system
  target_id   TEXT,             -- affected entity
  location    TEXT,             -- where it happened
  description TEXT,
  impact      JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_world_events_type ON eidolon_world_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_actor ON eidolon_world_events(actor_id);
