-- Migration 122: Calendar-aware proactive prefetch run ledger

CREATE TABLE IF NOT EXISTS proactive_calendar_prefetch_runs (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id            TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  calendar_event_id  TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  prefetch_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_calendar_prefetch_unique
  ON proactive_calendar_prefetch_runs (user_id, chat_id, calendar_event_id, prefetch_date);

CREATE INDEX IF NOT EXISTS idx_proactive_calendar_prefetch_user_created
  ON proactive_calendar_prefetch_runs (user_id, created_at DESC);
