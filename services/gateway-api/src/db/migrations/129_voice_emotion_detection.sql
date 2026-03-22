-- Migration 129: Voice emotion detection signals + settings (D5.3)

CREATE TABLE IF NOT EXISTS voice_emotion_signals (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT,
  chat_id            TEXT NOT NULL,
  message_id         TEXT NOT NULL,
  sender_identity_id TEXT,
  emotion_label      TEXT NOT NULL,
  confidence         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  provider           TEXT NOT NULL DEFAULT 'heuristic',
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_emotion_chat_created
  ON voice_emotion_signals (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_emotion_label_created
  ON voice_emotion_signals (emotion_label, created_at DESC);

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('voice.emotionDetection.enabled', 'false'::jsonb, NOW(), 'migration:129_voice_emotion_detection'),
  ('voice.emotionDetection.adjustTone', 'true'::jsonb, NOW(), 'migration:129_voice_emotion_detection')
ON CONFLICT (key) DO NOTHING;
