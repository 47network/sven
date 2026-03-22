-- Migration 128: Voice speaker identification profiles (D5.2)

CREATE TABLE IF NOT EXISTS voice_speaker_profiles (
  id              TEXT PRIMARY KEY,
  organization_id TEXT,
  chat_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  label           TEXT NOT NULL,
  signature       TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_speaker_profiles_unique
  ON voice_speaker_profiles (organization_id, chat_id, user_id, signature);

CREATE INDEX IF NOT EXISTS idx_voice_speaker_profiles_lookup
  ON voice_speaker_profiles (organization_id, chat_id, user_id, updated_at DESC);

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('voice.speakerIdentification.enabled', 'false'::jsonb, NOW(), 'migration:128_voice_speaker_identification')
ON CONFLICT (key) DO NOTHING;
