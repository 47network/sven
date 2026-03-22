BEGIN;

CREATE TABLE IF NOT EXISTS litellm_virtual_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  key_alias TEXT,
  virtual_key TEXT NOT NULL,
  max_daily_budget_usd DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_litellm_virtual_keys_org
  ON litellm_virtual_keys(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_litellm_virtual_keys_user
  ON litellm_virtual_keys(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_litellm_virtual_keys_agent
  ON litellm_virtual_keys(agent_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'litellm_virtual_keys_target_ck'
  ) THEN
    ALTER TABLE litellm_virtual_keys
      ADD CONSTRAINT litellm_virtual_keys_target_ck
      CHECK ((user_id IS NOT NULL) OR (agent_id IS NOT NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'litellm_virtual_keys_single_target_ck'
  ) THEN
    ALTER TABLE litellm_virtual_keys
      ADD CONSTRAINT litellm_virtual_keys_single_target_ck
      CHECK (NOT (user_id IS NOT NULL AND agent_id IS NOT NULL));
  END IF;
END $$;

COMMIT;
