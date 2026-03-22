ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_mime TEXT;

CREATE TABLE IF NOT EXISTS voice_transcripts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    transcript TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'faster-whisper',
    language TEXT,
    duration_ms INT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_transcripts_chat ON voice_transcripts (chat_id, retention_expires_at);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_message ON voice_transcripts (message_id);
