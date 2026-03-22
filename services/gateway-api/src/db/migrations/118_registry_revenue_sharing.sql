-- D1 Phase 4: revenue sharing model for premium skills.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS skill_monetization_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  catalog_entry_id TEXT NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
  creator_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  creator_share_bps INT NOT NULL DEFAULT 7000 CHECK (creator_share_bps >= 0 AND creator_share_bps <= 10000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, catalog_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_monetization_org_catalog
  ON skill_monetization_rules (organization_id, catalog_entry_id);

CREATE INDEX IF NOT EXISTS idx_skill_monetization_org_creator
  ON skill_monetization_rules (organization_id, creator_user_id);

CREATE TABLE IF NOT EXISTS skill_purchase_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  catalog_entry_id TEXT NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
  monetization_rule_id TEXT REFERENCES skill_monetization_rules(id) ON DELETE SET NULL,
  buyer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  creator_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  creator_amount_cents INT NOT NULL CHECK (creator_amount_cents >= 0),
  platform_amount_cents INT NOT NULL CHECK (platform_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'refunded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_purchase_org_catalog
  ON skill_purchase_events (organization_id, catalog_entry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_purchase_org_creator
  ON skill_purchase_events (organization_id, creator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_purchase_org_buyer
  ON skill_purchase_events (organization_id, buyer_user_id, created_at DESC);
