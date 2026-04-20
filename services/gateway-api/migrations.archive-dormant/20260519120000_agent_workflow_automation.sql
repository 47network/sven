-- Batch 46 — Agent Workflow Automation
-- Multi-step automated workflows with conditional logic, parallel branches,
-- retry policies, and integration with the task queue (Batch 45).

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  owner_agent_id TEXT NOT NULL,
  trigger_type   TEXT NOT NULL CHECK (trigger_type IN ('manual','scheduled','event','webhook','task_complete')),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived','failed')),
  version        INTEGER NOT NULL DEFAULT 1,
  input_schema   JSONB,
  tags           TEXT[] DEFAULT '{}',
  max_retries    INTEGER NOT NULL DEFAULT 3,
  timeout_ms     INTEGER NOT NULL DEFAULT 300000,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  name            TEXT NOT NULL,
  step_type       TEXT NOT NULL CHECK (step_type IN ('action','condition','parallel','loop','delay','sub_workflow','approval')),
  action_type     TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  input_mapping   JSONB DEFAULT '{}',
  output_mapping  JSONB DEFAULT '{}',
  on_failure      TEXT NOT NULL DEFAULT 'abort' CHECK (on_failure IN ('abort','skip','retry','fallback')),
  fallback_step_id TEXT,
  timeout_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, step_order)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  triggered_by    TEXT NOT NULL,
  run_status      TEXT NOT NULL DEFAULT 'pending' CHECK (run_status IN ('pending','running','paused','completed','failed','cancelled','timed_out')),
  input_data      JSONB DEFAULT '{}',
  output_data     JSONB DEFAULT '{}',
  current_step_id TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_step_results (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id       TEXT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  step_status   TEXT NOT NULL DEFAULT 'pending' CHECK (step_status IN ('pending','running','completed','failed','skipped','waiting_approval')),
  input_data    JSONB DEFAULT '{}',
  output_data   JSONB DEFAULT '{}',
  error_message TEXT,
  attempt       INTEGER NOT NULL DEFAULT 1,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL CHECK (category IN ('publishing','trading','research','marketing','devops','onboarding','content','custom')),
  template_data JSONB NOT NULL,
  author_id     TEXT,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  rating        NUMERIC(3,2) DEFAULT 0,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_owner ON workflow_definitions(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_trigger ON workflow_definitions(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_type ON workflow_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(run_status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_triggered ON workflow_runs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_step_results_run ON workflow_step_results(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_results_step ON workflow_step_results(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_results_status ON workflow_step_results(step_status);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_rating ON workflow_templates(rating DESC);
