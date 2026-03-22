-- Migration 033: Chat command session settings + compaction history

CREATE TABLE IF NOT EXISTS session_settings (
    session_id   TEXT PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    think_level  TEXT,
    "verbose"    BOOLEAN NOT NULL DEFAULT FALSE,
    usage_mode   TEXT NOT NULL DEFAULT 'off' CHECK (usage_mode IN ('off', 'tokens', 'full')),
    model_name   TEXT,
    rag_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by   TEXT
);

CREATE TABLE IF NOT EXISTS compaction_events (
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    before_tokens INT NOT NULL DEFAULT 0,
    after_tokens  INT NOT NULL DEFAULT 0,
    summary_text  TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compaction_events_session
  ON compaction_events(session_id, created_at DESC);
