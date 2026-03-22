-- Voice TTS Generated Audio Storage
-- Tracks all generated audio files with retention

CREATE TABLE IF NOT EXISTS voice_tts_generated (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    outbox_id TEXT NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    text TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'piper',
    voice TEXT,
    duration_ms INT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    retention_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_tts_generated_chat ON voice_tts_generated (chat_id, retention_expires_at);
CREATE INDEX IF NOT EXISTS idx_voice_tts_generated_outbox ON voice_tts_generated (outbox_id);
CREATE INDEX IF NOT EXISTS idx_voice_tts_generated_channel ON voice_tts_generated (channel);
