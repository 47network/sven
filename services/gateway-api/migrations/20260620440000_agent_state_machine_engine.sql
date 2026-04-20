-- Batch 407: State Machine Engine
-- Manages finite state machines for complex agent behavior with guard conditions and actions

CREATE TABLE IF NOT EXISTS agent_state_machine_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_machines INTEGER NOT NULL DEFAULT 100,
  history_retention_days INTEGER NOT NULL DEFAULT 90,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_state_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_state_machine_engine_configs(id),
  name TEXT NOT NULL,
  current_state TEXT NOT NULL,
  definition JSONB NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES agent_state_machines(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  event TEXT NOT NULL,
  guard_result BOOLEAN,
  action_output JSONB,
  context_before JSONB,
  context_after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_state_machines_config ON agent_state_machines(config_id);
CREATE INDEX idx_agent_state_machines_status ON agent_state_machines(status);
CREATE INDEX idx_agent_state_transitions_machine ON agent_state_transitions(machine_id);
CREATE INDEX idx_agent_state_transitions_created ON agent_state_transitions(created_at);
