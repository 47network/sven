-- Batch 94: Agent Data Validation
-- Validation schemas, rules, results, pipelines, and audit logs

CREATE TABLE IF NOT EXISTS validation_schemas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  schema_type TEXT NOT NULL DEFAULT 'json_schema' CHECK (schema_type IN ('json_schema','regex','custom','composite','range','enum')),
  definition JSONB NOT NULL DEFAULT '{}',
  is_strict BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','draft','archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_rules (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES validation_schemas(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('required','type','min','max','pattern','enum','custom','range','length','unique')),
  constraint_value JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error','warning','info','hint')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_results (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES validation_schemas(id),
  input_hash TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL DEFAULT '[]',
  fail_fast BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  total_runs BIGINT NOT NULL DEFAULT 0,
  pass_rate NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_audit_log (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT REFERENCES validation_pipelines(id),
  schema_id TEXT REFERENCES validation_schemas(id),
  action TEXT NOT NULL CHECK (action IN ('validate','skip','override','approve','reject','retry')),
  actor_id TEXT,
  input_summary TEXT,
  result_id TEXT REFERENCES validation_results(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vs_name ON validation_schemas(name);
CREATE INDEX idx_vs_type ON validation_schemas(schema_type);
CREATE INDEX idx_vs_status ON validation_schemas(status);
CREATE INDEX idx_vs_created ON validation_schemas(created_at DESC);
CREATE INDEX idx_vr_schema ON validation_rules(schema_id);
CREATE INDEX idx_vr_type ON validation_rules(rule_type);
CREATE INDEX idx_vr_severity ON validation_rules(severity);
CREATE INDEX idx_vr_active ON validation_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_vres_schema ON validation_results(schema_id);
CREATE INDEX idx_vres_valid ON validation_results(is_valid);
CREATE INDEX idx_vres_hash ON validation_results(input_hash);
CREATE INDEX idx_vres_validated ON validation_results(validated_at DESC);
CREATE INDEX idx_vp_name ON validation_pipelines(name);
CREATE INDEX idx_vp_status ON validation_pipelines(status);
CREATE INDEX idx_vp_runs ON validation_pipelines(total_runs DESC);
CREATE INDEX idx_vp_created ON validation_pipelines(created_at DESC);
CREATE INDEX idx_val_pipeline ON validation_audit_log(pipeline_id);
CREATE INDEX idx_val_schema ON validation_audit_log(schema_id);
CREATE INDEX idx_val_action ON validation_audit_log(action);
CREATE INDEX idx_val_created ON validation_audit_log(created_at DESC);
