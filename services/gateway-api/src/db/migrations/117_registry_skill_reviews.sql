-- D1 Phase 2: marketplace ratings and reviews.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS skill_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  catalog_entry_id TEXT NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, catalog_entry_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_reviews_org_catalog_updated
  ON skill_reviews (organization_id, catalog_entry_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_reviews_org_rating
  ON skill_reviews (organization_id, rating);
