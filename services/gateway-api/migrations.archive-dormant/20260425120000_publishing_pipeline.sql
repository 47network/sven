-- ---------------------------------------------------------------------------
-- Batch 21 — Publishing Pipeline
-- ---------------------------------------------------------------------------
-- Full editorial workflow: manuscript → editing → proofreading → formatting
-- → cover design → quality review → publication. Extends marketplace tasks
-- with 5 new task types for the publishing crew.
-- ---------------------------------------------------------------------------

-- 1) Publishing Projects — manuscript tracking
CREATE TABLE IF NOT EXISTS publishing_projects (
  id               TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL,
  author_agent_id  TEXT NOT NULL,
  title            TEXT NOT NULL,
  genre            TEXT NOT NULL,
  language         TEXT NOT NULL DEFAULT 'en',
  synopsis         TEXT,
  status           TEXT NOT NULL DEFAULT 'manuscript' CHECK (status IN (
    'manuscript', 'editing', 'proofreading', 'formatting',
    'cover_design', 'review', 'approved', 'published', 'rejected'
  )),
  word_count       INTEGER NOT NULL DEFAULT 0,
  chapter_count    INTEGER NOT NULL DEFAULT 0,
  target_format    TEXT NOT NULL DEFAULT 'epub' CHECK (target_format IN (
    'epub', 'kindle_mobi', 'pdf', 'paperback', 'hardcover', 'audiobook'
  )),
  manuscript_url   TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pub_projects_org    ON publishing_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_pub_projects_author ON publishing_projects(author_agent_id);
CREATE INDEX IF NOT EXISTS idx_pub_projects_status ON publishing_projects(status);
CREATE INDEX IF NOT EXISTS idx_pub_projects_genre  ON publishing_projects(genre);

-- 2) Editorial Stages — pipeline stage tracking per project
CREATE TABLE IF NOT EXISTS editorial_stages (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES publishing_projects(id),
  stage_type        TEXT NOT NULL CHECK (stage_type IN (
    'editing', 'proofreading', 'formatting', 'cover_design', 'review', 'genre_research'
  )),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed', 'skipped'
  )),
  assigned_agent_id TEXT,
  input_data        JSONB NOT NULL DEFAULT '{}',
  output_data       JSONB,
  notes             TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edit_stages_project ON editorial_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_edit_stages_agent   ON editorial_stages(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_edit_stages_status  ON editorial_stages(status);

-- 3) Quality Reviews — review/proofread/QA scoring
CREATE TABLE IF NOT EXISTS quality_reviews (
  id                TEXT PRIMARY KEY,
  stage_id          TEXT NOT NULL REFERENCES editorial_stages(id),
  project_id        TEXT NOT NULL REFERENCES publishing_projects(id),
  reviewer_agent_id TEXT NOT NULL,
  score             INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  category          TEXT NOT NULL CHECK (category IN (
    'grammar', 'style', 'plot', 'pacing', 'characters',
    'worldbuilding', 'formatting', 'cover', 'overall'
  )),
  feedback          TEXT,
  approved          BOOLEAN NOT NULL DEFAULT FALSE,
  criteria          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_stage   ON quality_reviews(stage_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_project ON quality_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_reviewer ON quality_reviews(reviewer_agent_id);

-- 4) Book Catalog — published books inventory
CREATE TABLE IF NOT EXISTS book_catalog (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL UNIQUE REFERENCES publishing_projects(id),
  listing_id    TEXT,
  isbn          TEXT UNIQUE,
  cover_url     TEXT,
  format        TEXT NOT NULL DEFAULT 'epub' CHECK (format IN (
    'epub', 'kindle_mobi', 'pdf', 'paperback', 'hardcover', 'audiobook'
  )),
  page_count    INTEGER NOT NULL DEFAULT 0,
  sales_count   INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}',
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_catalog_listing ON book_catalog(listing_id);
CREATE INDEX IF NOT EXISTS idx_book_catalog_isbn    ON book_catalog(isbn);

-- 5) Extend marketplace_tasks with publishing task types
-- Drop the old CHECK and re-create with expanded list
ALTER TABLE marketplace_tasks DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
ALTER TABLE marketplace_tasks ADD CONSTRAINT marketplace_tasks_task_type_check
  CHECK (task_type IN (
    'translate', 'write', 'design', 'research', 'support', 'custom',
    'review', 'proofread', 'format', 'cover_design', 'genre_research'
  ));
