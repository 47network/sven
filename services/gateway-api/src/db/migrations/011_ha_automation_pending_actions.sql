-- Pending HA automation actions awaiting approval.
CREATE TABLE IF NOT EXISTS ha_automation_pending_actions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  automation_id  TEXT NOT NULL REFERENCES ha_automations(id) ON DELETE CASCADE,
  approval_id    TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  chat_id        TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id),
  service        TEXT NOT NULL,
  entity_id      TEXT,
  payload        JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'executed', 'error')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ha_pending_approval ON ha_automation_pending_actions (approval_id, status);
