BEGIN;

ALTER TABLE model_registry
  ADD COLUMN IF NOT EXISTS cost_per_1k_tokens DECIMAL(10, 6);

CREATE TABLE IF NOT EXISTS model_usage_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id),
  user_id TEXT REFERENCES users(id),
  agent_id TEXT REFERENCES agents(id),
  request_tokens INT,
  response_tokens INT,
  total_cost DECIMAL(12, 6),
  latency_ms INT,
  status TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE model_usage_logs
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE model_usage_logs
  ADD COLUMN IF NOT EXISTS agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_model_usage_logs_org_time
  ON model_usage_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_model_time
  ON model_usage_logs(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_user_time
  ON model_usage_logs(user_id, created_at DESC);

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('llm.litellm.enabled', 'false'::jsonb, NOW(), 'migration:094_litellm_settings_costs'),
  ('llm.litellm.url', '"http://litellm:4000"'::jsonb, NOW(), 'migration:094_litellm_settings_costs'),
  ('llm.litellm.api_key', '""'::jsonb, NOW(), 'migration:094_litellm_settings_costs'),
  ('llm.litellm.use_virtual_keys', 'false'::jsonb, NOW(), 'migration:094_litellm_settings_costs')
ON CONFLICT (key) DO NOTHING;

COMMIT;
