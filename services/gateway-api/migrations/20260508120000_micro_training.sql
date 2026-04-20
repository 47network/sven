-- ============================================================================
-- Batch 34 — MicroGPT Fine-Tuning Pipeline
-- ============================================================================
-- Adds persistence for the model-trainer and micrograd skills.
-- Three tables: training_jobs (LoRA/QLoRA fine-tuning runs), training_datasets
-- (custom uploaded datasets), training_recipes (beyond built-in recipes).
-- ============================================================================

BEGIN;

-- ── training_jobs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_jobs (
  id              TEXT        PRIMARY KEY,
  org_id          TEXT        NOT NULL DEFAULT 'default',
  agent_id        TEXT,
  user_id         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','preparing','training','evaluating','exporting','completed','failed','cancelled')),
  base_model      TEXT        NOT NULL DEFAULT 'Qwen2.5-4B',
  adapter_type    TEXT        NOT NULL DEFAULT 'lora'
    CHECK (adapter_type IN ('lora','qlora','full')),
  recipe          TEXT
    CHECK (recipe IS NULL OR recipe IN ('writing_style','codebase_conventions','domain_vocabulary','task_specific','custom')),
  dataset_id      TEXT,
  data_sources    JSONB       NOT NULL DEFAULT '[]',
  sample_count    INTEGER     NOT NULL DEFAULT 0,
  train_samples   INTEGER     NOT NULL DEFAULT 0,
  eval_samples    INTEGER     NOT NULL DEFAULT 0,
  hyperparams     JSONB       NOT NULL DEFAULT '{}',
  current_epoch   INTEGER     NOT NULL DEFAULT 0,
  total_epochs    INTEGER     NOT NULL DEFAULT 3,
  current_step    INTEGER     NOT NULL DEFAULT 0,
  total_steps     INTEGER     NOT NULL DEFAULT 0,
  metrics         JSONB       NOT NULL DEFAULT '[]',
  evaluation      JSONB,
  output_model    TEXT,
  adapter_path    TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_org      ON training_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_agent    ON training_jobs (agent_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status   ON training_jobs (status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_recipe   ON training_jobs (recipe);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created  ON training_jobs (created_at DESC);

-- ── training_datasets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_datasets (
  id              TEXT        PRIMARY KEY,
  org_id          TEXT        NOT NULL DEFAULT 'default',
  name            TEXT        NOT NULL,
  description     TEXT,
  data_format     TEXT        NOT NULL DEFAULT 'instruction'
    CHECK (data_format IN ('conversation','instruction','completion','preference')),
  sample_count    INTEGER     NOT NULL DEFAULT 0,
  size_bytes      BIGINT      NOT NULL DEFAULT 0,
  source_url      TEXT,
  storage_path    TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_datasets_org     ON training_datasets (org_id);
CREATE INDEX IF NOT EXISTS idx_training_datasets_format  ON training_datasets (data_format);

-- ── training_recipes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_recipes (
  id              TEXT        PRIMARY KEY,
  org_id          TEXT        NOT NULL DEFAULT 'default',
  domain          TEXT        NOT NULL
    CHECK (domain IN ('writing_style','codebase_conventions','domain_vocabulary','task_specific','custom')),
  name            TEXT        NOT NULL,
  description     TEXT,
  base_model      TEXT        NOT NULL DEFAULT 'Qwen2.5-4B',
  adapter_type    TEXT        NOT NULL DEFAULT 'lora'
    CHECK (adapter_type IN ('lora','qlora','full')),
  config          JSONB       NOT NULL DEFAULT '{}',
  evaluation_prompts JSONB    NOT NULL DEFAULT '[]',
  usage_count     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_recipes_org      ON training_recipes (org_id);
CREATE INDEX IF NOT EXISTS idx_training_recipes_domain   ON training_recipes (domain);

-- ── expand marketplace task types ──────────────────────────────
ALTER TABLE marketplace_tasks DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
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
    'skill_catalog','skill_import','skill_audit',
    'video_create','video_render','video_preview',
    'avatar_customize','trait_evolve','mood_update',
    'training_create','training_monitor','training_export'
  ));

-- ── default settings ───────────────────────────────────────────
INSERT INTO settings_global (key, value) VALUES
  ('training.default_base_model', 'Qwen2.5-4B'),
  ('training.default_adapter_type', 'lora'),
  ('training.max_concurrent_jobs', '2'),
  ('training.default_epochs', '3'),
  ('training.auto_export_to_litellm', 'true')
ON CONFLICT (key) DO NOTHING;

COMMIT;
