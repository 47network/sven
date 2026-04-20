-- Batch 434: State Machine Runner
CREATE TABLE IF NOT EXISTS agent_state_machine_runner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_concurrent_machines INTEGER NOT NULL DEFAULT 100,
  history_retention_days INTEGER NOT NULL DEFAULT 90,
  visualization_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_state_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_state_machine_runner_configs(id),
  name TEXT NOT NULL,
  definition JSONB NOT NULL,
  current_state TEXT NOT NULL DEFAULT 'initial',
  context JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','completed','failed','terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES agent_state_machines(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  event_type TEXT NOT NULL,
  guard_result BOOLEAN,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_state_machine_runner_configs_agent ON agent_state_machine_runner_configs(agent_id);
CREATE INDEX idx_agent_state_machines_config ON agent_state_machines(config_id);
CREATE INDEX idx_agent_state_transitions_machine ON agent_state_transitions(machine_id);
