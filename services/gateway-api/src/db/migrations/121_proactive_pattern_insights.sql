-- Migration 121: Proactive pattern detection insights

CREATE TABLE IF NOT EXISTS proactive_pattern_insights (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id              TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  normalized_question  TEXT NOT NULL,
  sample_question      TEXT NOT NULL,
  occurrences          INTEGER NOT NULL DEFAULT 0,
  first_seen_at        TIMESTAMPTZ NOT NULL,
  last_seen_at         TIMESTAMPTZ NOT NULL,
  suggested_answer     TEXT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved')),
  last_notified_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_pattern_unique
  ON proactive_pattern_insights (organization_id, user_id, chat_id, normalized_question);

CREATE INDEX IF NOT EXISTS idx_proactive_pattern_org_user_last_seen
  ON proactive_pattern_insights (organization_id, user_id, last_seen_at DESC);
