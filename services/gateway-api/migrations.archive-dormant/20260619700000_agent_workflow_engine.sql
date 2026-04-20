CREATE TABLE IF NOT EXISTS agent_workflow_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  execution_mode VARCHAR(50) DEFAULT 'sequential' CHECK (execution_mode IN ('sequential','parallel','conditional','event_driven')),
  max_concurrent_steps INT DEFAULT 5,
  retry_policy JSONB DEFAULT '{}',
  timeout_seconds INT DEFAULT 3600,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_workflow_engine_configs(id),
  name VARCHAR(255) NOT NULL,
  version INT DEFAULT 1,
  steps JSONB NOT NULL DEFAULT '[]',
  triggers JSONB DEFAULT '[]',
  variables JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES agent_workflow_definitions(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled','paused')),
  current_step INT DEFAULT 0,
  step_results JSONB DEFAULT '[]',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_workflow_engine_agent ON agent_workflow_engine_configs(agent_id);
CREATE INDEX idx_workflow_def_config ON agent_workflow_definitions(config_id);
CREATE INDEX idx_workflow_exec_def ON agent_workflow_executions(definition_id);
CREATE INDEX idx_workflow_exec_status ON agent_workflow_executions(status);
