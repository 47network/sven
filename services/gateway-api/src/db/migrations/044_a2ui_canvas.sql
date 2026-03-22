-- Migration 044: Live Canvas A2UI state and interaction logs

CREATE TABLE IF NOT EXISTS a2ui_state (
    chat_id     TEXT PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    version     INTEGER NOT NULL DEFAULT 0,
    html        TEXT NOT NULL DEFAULT '',
    component   TEXT NOT NULL DEFAULT '',
    state       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS a2ui_interactions (
    id          TEXT PRIMARY KEY,
    chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_a2ui_interactions_chat_created
  ON a2ui_interactions(chat_id, created_at DESC);
