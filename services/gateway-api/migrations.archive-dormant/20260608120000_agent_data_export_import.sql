-- Batch 66: Agent Data Export & Import
-- Bulk data portability, migration packages, format conversion

CREATE TABLE IF NOT EXISTS data_export_jobs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  export_type     TEXT NOT NULL CHECK (export_type IN ('full', 'partial', 'incremental', 'snapshot', 'migration')),
  export_format   TEXT NOT NULL CHECK (export_format IN ('json', 'csv', 'parquet', 'sqlite', 'archive')),
  status          TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'expired')) DEFAULT 'queued',
  scope           TEXT NOT NULL CHECK (scope IN ('agent', 'crew', 'project', 'workspace', 'all')) DEFAULT 'agent',
  include_tables  TEXT[] NOT NULL DEFAULT '{}',
  exclude_tables  TEXT[] NOT NULL DEFAULT '{}',
  file_path       TEXT,
  file_size_bytes BIGINT,
  row_count       INTEGER,
  checksum        TEXT,
  expires_at      TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_import_jobs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  import_type     TEXT NOT NULL CHECK (import_type IN ('full', 'partial', 'merge', 'overwrite', 'migration')),
  source_format   TEXT NOT NULL CHECK (source_format IN ('json', 'csv', 'parquet', 'sqlite', 'archive')),
  status          TEXT NOT NULL CHECK (status IN ('validating', 'importing', 'completed', 'failed', 'rolled_back')) DEFAULT 'validating',
  file_path       TEXT NOT NULL,
  file_size_bytes BIGINT,
  rows_processed  INTEGER NOT NULL DEFAULT 0,
  rows_skipped    INTEGER NOT NULL DEFAULT 0,
  rows_failed     INTEGER NOT NULL DEFAULT 0,
  conflict_strategy TEXT NOT NULL CHECK (conflict_strategy IN ('skip', 'overwrite', 'merge', 'error')) DEFAULT 'skip',
  validation_errors JSONB NOT NULL DEFAULT '[]',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_schemas (
  id              TEXT PRIMARY KEY,
  schema_name     TEXT NOT NULL UNIQUE,
  schema_version  TEXT NOT NULL DEFAULT '1.0.0',
  table_name      TEXT NOT NULL,
  columns         JSONB NOT NULL DEFAULT '[]',
  constraints     JSONB NOT NULL DEFAULT '[]',
  is_exportable   BOOLEAN NOT NULL DEFAULT TRUE,
  is_importable   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_mappings (
  id              TEXT PRIMARY KEY,
  mapping_name    TEXT NOT NULL,
  source_schema   TEXT NOT NULL,
  target_schema   TEXT NOT NULL,
  field_mappings  JSONB NOT NULL DEFAULT '{}',
  transformations JSONB NOT NULL DEFAULT '[]',
  is_bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_transfer_logs (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL,
  job_type        TEXT NOT NULL CHECK (job_type IN ('export', 'import')),
  action          TEXT NOT NULL CHECK (action IN ('started', 'progress', 'completed', 'failed', 'cancelled')),
  details         JSONB NOT NULL DEFAULT '{}',
  progress_pct    INTEGER CHECK (progress_pct BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_agent ON data_export_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_type ON data_export_jobs(export_type);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON data_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_format ON data_export_jobs(export_format);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON data_export_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_agent ON data_import_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_type ON data_import_jobs(import_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON data_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_format ON data_import_jobs(source_format);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created ON data_import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schemas_name ON data_schemas(schema_name);
CREATE INDEX IF NOT EXISTS idx_schemas_table ON data_schemas(table_name);
CREATE INDEX IF NOT EXISTS idx_schemas_exportable ON data_schemas(is_exportable) WHERE is_exportable = TRUE;
CREATE INDEX IF NOT EXISTS idx_mappings_source ON data_mappings(source_schema);
CREATE INDEX IF NOT EXISTS idx_mappings_target ON data_mappings(target_schema);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_job ON data_transfer_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_type ON data_transfer_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_action ON data_transfer_logs(action);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_created ON data_transfer_logs(created_at DESC);
