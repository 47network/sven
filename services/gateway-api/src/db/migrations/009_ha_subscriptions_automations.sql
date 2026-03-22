-- Home Assistant subscriptions and automations storage.
CREATE TABLE IF NOT EXISTS ha_subscriptions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id           TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  entity_id         TEXT NOT NULL,
  match_state       TEXT,
  match_attribute   TEXT,
  match_value       TEXT,
  cooldown_seconds  INT NOT NULL DEFAULT 300,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  last_state        TEXT,
  last_attributes   JSONB,
  last_notified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ha_subscriptions_entity ON ha_subscriptions (entity_id, enabled);

CREATE TABLE IF NOT EXISTS ha_automations (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  trigger     JSONB NOT NULL DEFAULT '{}',
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ha_automations_chat ON ha_automations (chat_id, enabled);
