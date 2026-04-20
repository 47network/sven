CREATE TABLE IF NOT EXISTS agent_workflow_automator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_workflows INTEGER NOT NULL DEFAULT 5,
  retry_on_failure BOOLEAN NOT NULL DEFAULT true,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_workflow_automator_configs(id),
  agent_id UUID NOT NULL,
  workflow_name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'draft',
  step_count INTEGER NOT NULL DEFAULT 0,
  current_step INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(id),
  step_index INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  input_config JSONB NOT NULL DEFAULT '{}',
  output_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflows_agent ON agent_workflows(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON agent_workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON agent_workflow_steps(workflow_id);
