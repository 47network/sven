ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_memories_organization_id
  ON memories (organization_id);

UPDATE memories m
SET organization_id = c.organization_id
FROM chats c
WHERE m.organization_id IS NULL
  AND m.chat_id = c.id;

UPDATE memories m
SET organization_id = u.active_organization_id
FROM users u
WHERE m.organization_id IS NULL
  AND m.user_id = u.id
  AND u.active_organization_id IS NOT NULL;

ALTER TABLE kg_entities
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

UPDATE kg_entities
SET created_at = COALESCE(first_seen_at, updated_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kg_entities_created_at
  ON kg_entities (created_at DESC);
