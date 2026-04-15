-- ---------------------------------------------------------------------------
-- Migration: Model Trainer — Fine-Tuning Pipeline
-- ---------------------------------------------------------------------------
-- Persists training jobs, datasets, and model exports.
-- ---------------------------------------------------------------------------

-- training_jobs — fine-tuning job tracking
CREATE TABLE IF NOT EXISTS training_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  user_id         UUID,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'training', 'evaluating', 'exporting', 'completed', 'failed', 'cancelled')),
  recipe          TEXT CHECK (recipe IN ('writing_style', 'codebase_conventions', 'domain_vocabulary', 'task_specific', 'custom')),
  base_model      TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'qlora' CHECK (method IN ('lora', 'qlora', 'full')),
  config          JSONB NOT NULL DEFAULT '{}',
  data_sources    JSONB NOT NULL DEFAULT '[]',
  sample_count    INTEGER NOT NULL DEFAULT 0,
  train_samples   INTEGER NOT NULL DEFAULT 0,
  eval_samples    INTEGER NOT NULL DEFAULT 0,
  current_step    INTEGER NOT NULL DEFAULT 0,
  total_steps     INTEGER NOT NULL DEFAULT 0,
  current_epoch   INTEGER NOT NULL DEFAULT 0,
  latest_loss     REAL,
  evaluation      JSONB,
  output_adapter_path TEXT,
  output_model_name TEXT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_org
  ON training_jobs (org_id);

CREATE INDEX IF NOT EXISTS idx_training_jobs_status
  ON training_jobs (status);

CREATE INDEX IF NOT EXISTS idx_training_jobs_org_status
  ON training_jobs (org_id, status);

CREATE INDEX IF NOT EXISTS idx_training_jobs_created
  ON training_jobs (created_at DESC);

-- training_metrics — step-level metrics log
CREATE TABLE IF NOT EXISTS training_metrics (
  id              BIGSERIAL PRIMARY KEY,
  job_id          UUID NOT NULL REFERENCES training_jobs(id) ON DELETE CASCADE,
  step            INTEGER NOT NULL,
  epoch           INTEGER NOT NULL,
  train_loss      REAL NOT NULL,
  eval_loss       REAL,
  learning_rate   REAL NOT NULL,
  throughput      REAL,
  gpu_memory_mb   REAL,
  elapsed_ms      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_metrics_job
  ON training_metrics (job_id, step);

-- training_datasets — prepared training data references
CREATE TABLE IF NOT EXISTS training_datasets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  job_id          UUID REFERENCES training_jobs(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  format          TEXT NOT NULL CHECK (format IN ('conversation', 'instruction', 'completion', 'preference')),
  sample_count    INTEGER NOT NULL DEFAULT 0,
  storage_path    TEXT,
  size_bytes      BIGINT,
  checksum        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_datasets_org
  ON training_datasets (org_id);

CREATE INDEX IF NOT EXISTS idx_training_datasets_job
  ON training_datasets (job_id);

-- model_exports — registered fine-tuned model adapters
CREATE TABLE IF NOT EXISTS model_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES training_jobs(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  base_model      TEXT NOT NULL,
  adapter_path    TEXT NOT NULL,
  merged_model_path TEXT,
  litellm_model_name TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_exports_org
  ON model_exports (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_exports_litellm_name
  ON model_exports (litellm_model_name);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_training_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_training_jobs_updated_at
  BEFORE UPDATE ON training_jobs
  FOR EACH ROW EXECUTE FUNCTION update_training_jobs_updated_at();
