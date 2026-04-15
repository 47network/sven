-- ---------------------------------------------------------------------------
-- Migration: Companion Engine — Desktop Character State
-- ---------------------------------------------------------------------------
-- Persists companion sessions, preferences, and custom character forms.
-- ---------------------------------------------------------------------------

-- companion_sessions — persistent user companion state
CREATE TABLE IF NOT EXISTS companion_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  user_id         UUID NOT NULL,
  form            TEXT NOT NULL CHECK (form IN ('orb', 'aria', 'rex', 'orion', 'custom')),
  preferences     JSONB NOT NULL DEFAULT '{}',
  custom_form_spec JSONB,
  last_state      TEXT NOT NULL DEFAULT 'idle' CHECK (last_state IN ('idle', 'listening', 'thinking', 'speaking', 'celebrating', 'sleeping', 'working', 'error')),
  last_emotion    TEXT NOT NULL DEFAULT 'neutral',
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active session per user per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_sessions_org_user
  ON companion_sessions (org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_companion_sessions_org
  ON companion_sessions (org_id);

CREATE INDEX IF NOT EXISTS idx_companion_sessions_last_activity
  ON companion_sessions (last_activity_at);

-- companion_sound_packs — custom sound effect packs
CREATE TABLE IF NOT EXISTS companion_sound_packs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  sounds          JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_sound_packs_org
  ON companion_sound_packs (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_sound_packs_org_name
  ON companion_sound_packs (org_id, name);

-- companion_state_log — audit log of state transitions for analytics
CREATE TABLE IF NOT EXISTS companion_state_log (
  id              BIGSERIAL PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES companion_sessions(id) ON DELETE CASCADE,
  from_state      TEXT NOT NULL,
  to_state        TEXT NOT NULL,
  trigger_event   TEXT NOT NULL,
  emotion         TEXT,
  intensity       REAL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_state_log_session
  ON companion_state_log (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_state_log_created
  ON companion_state_log (created_at);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_companion_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companion_sessions_updated_at
  BEFORE UPDATE ON companion_sessions
  FOR EACH ROW EXECUTE FUNCTION update_companion_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_companion_sound_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companion_sound_packs_updated_at
  BEFORE UPDATE ON companion_sound_packs
  FOR EACH ROW EXECUTE FUNCTION update_companion_sound_packs_updated_at();
