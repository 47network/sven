-- Batch 71: Agent Pipeline Templates
-- Reusable workflow templates, pipeline definitions, stage orchestration, and template marketplace

CREATE TABLE IF NOT EXISTS pipeline_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','ci_cd','data','ml','content','publishing','testing','deployment')),
  version         TEXT NOT NULL DEFAULT '1.0.0',
  author_agent_id TEXT,
  stages          JSONB NOT NULL DEFAULT '[]',
  parameters      JSONB NOT NULL DEFAULT '{}',
  is_public       BOOLEAN NOT NULL DEFAULT false,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  rating          NUMERIC(3,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_instances (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  agent_id        TEXT,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','failed','cancelled')),
  current_stage   INTEGER NOT NULL DEFAULT 0,
  parameters      JSONB NOT NULL DEFAULT '{}',
  context         JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id              TEXT PRIMARY KEY,
  instance_id     TEXT NOT NULL REFERENCES pipeline_instances(id) ON DELETE CASCADE,
  stage_index     INTEGER NOT NULL,
  name            TEXT NOT NULL,
  task_type       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  input_data      JSONB DEFAULT '{}',
  output_data     JSONB DEFAULT '{}',
  depends_on      JSONB DEFAULT '[]',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_triggers (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('manual','schedule','event','webhook','condition')),
  config          JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_fired_at   TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_artifacts (
  id              TEXT PRIMARY KEY,
  instance_id     TEXT NOT NULL REFERENCES pipeline_instances(id) ON DELETE CASCADE,
  stage_id        TEXT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  artifact_type   TEXT NOT NULL CHECK (artifact_type IN ('file','report','log','metric','model','dataset')),
  content         JSONB DEFAULT '{}',
  size_bytes      BIGINT DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_category ON pipeline_templates(category);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_author ON pipeline_templates(author_agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_public ON pipeline_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_usage ON pipeline_templates(usage_count);
CREATE INDEX IF NOT EXISTS idx_pipeline_instances_template ON pipeline_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_instances_agent ON pipeline_instances(agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_instances_status ON pipeline_instances(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_instances_created ON pipeline_instances(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_instance ON pipeline_stages(instance_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_status ON pipeline_stages(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_index ON pipeline_stages(stage_index);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_task ON pipeline_stages(task_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_template ON pipeline_triggers(template_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_type ON pipeline_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_enabled ON pipeline_triggers(enabled);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_fired ON pipeline_triggers(last_fired_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_instance ON pipeline_artifacts(instance_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_stage ON pipeline_artifacts(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_type ON pipeline_artifacts(artifact_type);
