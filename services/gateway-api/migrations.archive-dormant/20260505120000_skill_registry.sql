-- Batch 31 — Skill Registry: catalog, import, quality assessment
-- Tracks all 111+ skills, enables gap analysis, import pipeline, quality scoring

-- ── skill_registry ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_registry (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL CHECK (category IN (
    'ai-agency','autonomous-economy','compute-mesh','design',
    'email-generic','marketing','notifications','ocr',
    'productivity','security','trading','data-engineering',
    'web-scraping','devops','research','quantum','automotive'
  )),
  source        TEXT NOT NULL DEFAULT 'native' CHECK (source IN (
    'native','imported','community','forked'
  )),
  version       TEXT NOT NULL DEFAULT '1.0.0',
  integration_status TEXT NOT NULL DEFAULT 'integrated' CHECK (integration_status IN (
    'discovered','evaluating','adapting','testing','integrated','deprecated'
  )),
  quality_tier  TEXT NOT NULL DEFAULT 'stable' CHECK (quality_tier IN (
    'experimental','beta','stable','certified'
  )),
  archetype     TEXT,
  description   TEXT,
  actions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  pricing       JSONB NOT NULL DEFAULT '{}'::jsonb,
  skill_path    TEXT,
  marketplace_listing_id TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_registry_category ON skill_registry(category);
CREATE INDEX idx_skill_registry_source ON skill_registry(source);
CREATE INDEX idx_skill_registry_status ON skill_registry(integration_status);
CREATE INDEX idx_skill_registry_tier ON skill_registry(quality_tier);
CREATE INDEX idx_skill_registry_archetype ON skill_registry(archetype);

-- ── skill_quality_assessments ──────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_quality_assessments (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  skill_id          TEXT NOT NULL REFERENCES skill_registry(id) ON DELETE CASCADE,
  assessor_agent_id TEXT,
  score             INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  categories        JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_results      JSONB NOT NULL DEFAULT '[]'::jsonb,
  coverage_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  pass_count        INTEGER NOT NULL DEFAULT 0,
  fail_count        INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_quality_skill ON skill_quality_assessments(skill_id);
CREATE INDEX idx_skill_quality_score ON skill_quality_assessments(score);
CREATE INDEX idx_skill_quality_assessor ON skill_quality_assessments(assessor_agent_id);

-- ── skill_import_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_import_log (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_url    TEXT,
  source_type   TEXT NOT NULL CHECK (source_type IN (
    'github','npm','local','url','marketplace'
  )),
  skill_name    TEXT NOT NULL,
  import_status TEXT NOT NULL DEFAULT 'pending' CHECK (import_status IN (
    'pending','downloading','adapting','testing','completed','failed'
  )),
  imported_by   TEXT,
  target_category TEXT,
  error_message TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_import_status ON skill_import_log(import_status);
CREATE INDEX idx_skill_import_name ON skill_import_log(skill_name);
CREATE INDEX idx_skill_import_source ON skill_import_log(source_type);
CREATE INDEX idx_skill_import_by ON skill_import_log(imported_by);
CREATE INDEX idx_skill_import_created ON skill_import_log(created_at);

-- ── extend marketplace_tasks ───────────────────────────────────
ALTER TABLE marketplace_tasks
  DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;

ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'code','research','design','writing','support','testing','review',
    'translate','proofread','format','cover_design','genre_research',
    'misiuni_post','misiuni_verify','social_post','social_analytics',
    'xlvii_design','xlvii_catalog',
    'council_deliberate','council_vote',
    'memory_store','memory_retrieve','memory_compress',
    'fleet_deploy','fleet_benchmark','fleet_evict',
    'evolve_propose','evolve_experiment','evolve_rollback',
    'skill_catalog','skill_import','skill_audit'
  ));

-- ── default settings ───────────────────────────────────────────
INSERT INTO settings_global (key, value) VALUES
  ('skill_registry.auto_discover', 'true'),
  ('skill_registry.quality_threshold', '70'),
  ('skill_registry.auto_list_on_marketplace', 'true'),
  ('skill_registry.import_timeout_s', '300'),
  ('skill_registry.max_concurrent_imports', '5')
ON CONFLICT (key) DO NOTHING;
