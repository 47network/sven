-- Add missing columns to workflows table
ALTER TABLE workflows
ADD COLUMN IF NOT EXISTS chat_id TEXT,
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS edges JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS updated_by TEXT,
ADD COLUMN IF NOT EXISTS change_summary TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add foreign keys
ALTER TABLE workflows
ADD CONSTRAINT fk_workflows_chats FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_workflows_created_by FOREIGN KEY (created_by) REFERENCES identities(id),
ADD CONSTRAINT fk_workflows_updated_by FOREIGN KEY (updated_by) REFERENCES identities(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflows_chat ON workflows(chat_id);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

-- Workflow versions: immutable snapshots
CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version INT NOT NULL,
  steps JSONB NOT NULL,
  edges JSONB NOT NULL,
  change_summary TEXT,
  created_by TEXT NOT NULL REFERENCES identities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);

-- Workflow runs: execution instances
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  workflow_version INT NOT NULL,
  
  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, paused, completed, failed, cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Trigger context
  triggered_by TEXT REFERENCES identities(id),
  trigger_message_id TEXT,
  input_variables JSONB,
  
  -- Execution tracking
  step_results JSONB NOT NULL DEFAULT '{}',  -- {step_id: {status, output, error, attempts}}
  total_steps INT,
  completed_steps INT DEFAULT 0,
  failed_steps INT DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Output
  output_variables JSONB,
  canvas_event_id TEXT REFERENCES canvas_events(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_triggered_by ON workflow_runs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at DESC);

-- Workflow step runs: individual step execution tracking
CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  
  -- Step type and config snapshot
  step_type TEXT NOT NULL,  -- tool_call, approval, conditional, notification
  step_config JSONB NOT NULL,
  
  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, waiting_approval, skipped
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Attempts and retry logic
  attempt_number INT DEFAULT 1,
  max_retries INT DEFAULT 0,
  
  -- Step-specific data
  input_variables JSONB,
  output_variables JSONB,
  error_message TEXT,
  
  -- Tool runs reference
  tool_run_id TEXT REFERENCES tool_runs(id),
  
  -- Approval references
  approval_id TEXT REFERENCES approvals(id),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON workflow_step_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_status ON workflow_step_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_step_type ON workflow_step_runs(step_type);

-- Workflow variables: templated inputs/outputs per workflow
CREATE TABLE IF NOT EXISTS workflow_variables (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  var_type TEXT NOT NULL,  -- string, number, boolean, array, object
  var_description TEXT,
  is_input BOOLEAN DEFAULT false,  -- true if input, false if internal/output
  default_value JSONB,
  validation_schema JSONB,  -- JSON schema for type checking
  
  UNIQUE(workflow_id, var_name)
);

CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow ON workflow_variables(workflow_id);

-- Workflow triggers: when workflows auto-start
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  
  trigger_type TEXT NOT NULL,  -- manual, on_message, on_tool_result, scheduled, on_webhook
  trigger_config JSONB NOT NULL,  -- type-specific config
  
  enabled BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL REFERENCES identities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_type ON workflow_triggers(trigger_type);

-- Workflow audit log: track all changes
CREATE TABLE IF NOT EXISTS workflow_audit_log (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL,  -- created, updated, executed, step_started, step_completed, step_failed
  actor_id TEXT NOT NULL REFERENCES identities(id),
  
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_log_workflow ON workflow_audit_log(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_log_run ON workflow_audit_log(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_log_created_at ON workflow_audit_log(created_at DESC);
