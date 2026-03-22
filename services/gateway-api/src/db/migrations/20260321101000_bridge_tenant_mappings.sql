BEGIN;

CREATE TABLE IF NOT EXISTS bridge_tenant_mappings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_platform TEXT NOT NULL,
  external_tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_platform, external_tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_tenant_mappings_active_lookup
  ON bridge_tenant_mappings (source_platform, external_tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bridge_tenant_mappings_org
  ON bridge_tenant_mappings (organization_id, is_active);

-- Seed wildcard fallback mapping for current legacy 47Dynamics deployment.
INSERT INTO bridge_tenant_mappings (
  id,
  source_platform,
  external_tenant_id,
  organization_id,
  chat_id,
  agent_id,
  is_active,
  metadata,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  '47dynamics',
  '*',
  '47dynamics-legacy-org',
  '47dynamics-hq',
  '47dynamics-copilot',
  TRUE,
  '{"seeded_from":"legacy_defaults"}'::jsonb,
  NOW(),
  NOW()
WHERE EXISTS (
  SELECT 1 FROM organizations WHERE id = '47dynamics-legacy-org'
)
AND EXISTS (
  SELECT 1 FROM chats WHERE id = '47dynamics-hq'
)
ON CONFLICT (source_platform, external_tenant_id) DO NOTHING;

COMMIT;
