-- Batch 96: Agent Workflow Templates
-- Reusable workflow templates with steps, triggers, and execution history

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','publishing','marketing','development','data','operations','finance','creative')),
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  input_schema JSONB DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','draft','archived')),
  usage_count BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL,
  input_mapping JSONB DEFAULT '{}',
  output_mapping JSONB DEFAULT '{}',
  condition JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_triggers (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual','schedule','event','webhook','condition','cron')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  fire_count BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workflow_templates(id),
  trigger_id TEXT REFERENCES workflow_triggers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled','paused')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_step_results (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES workflow_steps(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wt_name ON workflow_templates(name);
CREATE INDEX idx_wt_category ON workflow_templates(category);
CREATE INDEX idx_wt_status ON workflow_templates(status);
CREATE INDEX idx_wt_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_ws_template ON workflow_steps(template_id);
CREATE INDEX idx_ws_order ON workflow_steps(step_order);
CREATE INDEX idx_ws_action ON workflow_steps(action);
CREATE INDEX idx_ws_created ON workflow_steps(created_at DESC);
CREATE INDEX idx_wtr_template ON workflow_triggers(template_id);
CREATE INDEX idx_wtr_type ON workflow_triggers(trigger_type);
CREATE INDEX idx_wtr_active ON workflow_triggers(is_active) WHERE is_active = true;
CREATE INDEX idx_wtr_fired ON workflow_triggers(last_fired_at DESC);
CREATE INDEX idx_we_template ON workflow_executions(template_id);
CREATE INDEX idx_we_status ON workflow_executions(status);
CREATE INDEX idx_we_trigger ON workflow_executions(trigger_id);
CREATE INDEX idx_we_started ON workflow_executions(started_at DESC);
CREATE INDEX idx_wsr_exec ON workflow_step_results(execution_id);
CREATE INDEX idx_wsr_step ON workflow_step_results(step_id);
CREATE INDEX idx_wsr_status ON workflow_step_results(status);
CREATE INDEX idx_wsr_created ON workflow_step_results(created_at DESC);
