-- Batch 36 — Academic Assistance Platform
-- Legitimate tutoring, formatting, citation, and research assistance
-- for Romanian university students (licență / lucrare de diplomă).

BEGIN;

-- ── Academic service offerings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_services (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  service_type  TEXT NOT NULL CHECK (service_type IN (
    'tutoring', 'formatting', 'citation_review', 'bibliography',
    'research_guidance', 'methodology_review', 'structure_review',
    'plagiarism_check', 'language_editing', 'presentation_coaching',
    'statistical_analysis', 'literature_review'
  )),
  language      TEXT NOT NULL DEFAULT 'ro',
  price_tokens  NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_eur     NUMERIC(12,2) NOT NULL DEFAULT 0,
  agent_id      TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Academic projects (student submissions) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_projects (
  id              TEXT PRIMARY KEY,
  student_alias   TEXT NOT NULL DEFAULT 'anonymous',
  project_type    TEXT NOT NULL CHECK (project_type IN (
    'licenta', 'disertatie', 'referat', 'eseu', 'proiect_semestrial',
    'teza_doctorat', 'articol_stiintific', 'prezentare'
  )),
  title           TEXT NOT NULL DEFAULT '',
  faculty         TEXT NOT NULL DEFAULT '',
  university      TEXT NOT NULL DEFAULT '',
  language        TEXT NOT NULL DEFAULT 'ro',
  word_count      INTEGER NOT NULL DEFAULT 0,
  page_count      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'in_review', 'formatting', 'citation_check',
    'language_edit', 'completed', 'delivered', 'cancelled'
  )),
  deadline        TIMESTAMPTZ,
  assigned_agents JSONB NOT NULL DEFAULT '[]',
  services_used   JSONB NOT NULL DEFAULT '[]',
  quality_score   NUMERIC(5,2) CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  feedback        TEXT NOT NULL DEFAULT '',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Academic review stages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_reviews (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES academic_projects(id) ON DELETE CASCADE,
  service_id    TEXT REFERENCES academic_services(id),
  reviewer_id   TEXT NOT NULL,
  review_type   TEXT NOT NULL CHECK (review_type IN (
    'formatting', 'citation', 'plagiarism', 'grammar', 'structure',
    'methodology', 'content_quality', 'presentation', 'final_check'
  )),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'needs_revision'
  )),
  score         NUMERIC(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  findings      JSONB NOT NULL DEFAULT '[]',
  suggestions   JSONB NOT NULL DEFAULT '[]',
  corrected     BOOLEAN NOT NULL DEFAULT FALSE,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Citation database (reference library) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_citations (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES academic_projects(id) ON DELETE CASCADE,
  citation_style  TEXT NOT NULL DEFAULT 'apa7' CHECK (citation_style IN (
    'apa7', 'chicago', 'mla9', 'ieee', 'harvard', 'iso690', 'vancouver'
  )),
  source_type     TEXT NOT NULL CHECK (source_type IN (
    'book', 'journal', 'website', 'conference', 'thesis',
    'report', 'legislation', 'standard', 'patent'
  )),
  raw_text        TEXT NOT NULL DEFAULT '',
  formatted_text  TEXT NOT NULL DEFAULT '',
  valid           BOOLEAN NOT NULL DEFAULT FALSE,
  doi             TEXT,
  url             TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academic_services_type ON academic_services(service_type);
CREATE INDEX IF NOT EXISTS idx_academic_services_agent ON academic_services(agent_id);
CREATE INDEX IF NOT EXISTS idx_academic_projects_status ON academic_projects(status);
CREATE INDEX IF NOT EXISTS idx_academic_projects_type ON academic_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_academic_reviews_project ON academic_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_academic_reviews_type ON academic_reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_academic_citations_project ON academic_citations(project_id);
CREATE INDEX IF NOT EXISTS idx_academic_citations_style ON academic_citations(citation_style);

-- ── Extend marketplace_tasks CHECK for academic task types ───────────────────
ALTER TABLE marketplace_tasks
  DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;

ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'auto_task', 'translate', 'write', 'design', 'research', 'support',
    'review', 'proofread', 'format', 'cover_design', 'genre_research',
    'misiuni_post', 'misiuni_verify', 'legal_research', 'print_broker',
    'trend_research', 'author_persona', 'social_post', 'social_analytics',
    'merch_listing', 'product_design', 'council_deliberate', 'council_vote',
    'memory_remember', 'memory_recall', 'memory_compress',
    'fleet_deploy', 'fleet_benchmark', 'fleet_evict',
    'evolve_propose', 'evolve_experiment', 'evolve_rollback',
    'skill_catalog', 'skill_import', 'skill_audit',
    'video_create', 'video_render', 'video_preview',
    'avatar_customize', 'trait_evolve', 'mood_update',
    'training_create', 'training_monitor', 'training_export',
    'academic_assist', 'academic_format', 'academic_cite', 'academic_review'
  ));

COMMIT;
