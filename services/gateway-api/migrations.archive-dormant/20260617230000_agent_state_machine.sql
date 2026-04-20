-- Batch 86: Agent State Machine
-- Finite state machines for agent workflow orchestration

CREATE TABLE IF NOT EXISTS state_machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agent_id TEXT,
  current_state TEXT NOT NULL,
  initial_state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','completed','failed','cancelled')),
  context JSONB DEFAULT '{}',
  history_count INTEGER NOT NULL DEFAULT 0,
  max_transitions INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS state_definitions (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL REFERENCES state_machines(id) ON DELETE CASCADE,
  state_name TEXT NOT NULL,
  state_type TEXT NOT NULL DEFAULT 'normal' CHECK (state_type IN ('initial','normal','final','parallel','history','error')),
  on_enter_action TEXT,
  on_exit_action TEXT,
  timeout_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(machine_id, state_name)
);

CREATE TABLE IF NOT EXISTS state_transitions (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL REFERENCES state_machines(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  event_name TEXT NOT NULL,
  guard_condition TEXT,
  action TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS state_history (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL REFERENCES state_machines(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  event_name TEXT NOT NULL,
  transition_id TEXT REFERENCES state_transitions(id),
  context_snapshot JSONB DEFAULT '{}',
  duration_ms NUMERIC(10,3),
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS state_machine_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  states JSONB NOT NULL DEFAULT '[]',
  transitions JSONB NOT NULL DEFAULT '[]',
  initial_state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sm_agent ON state_machines(agent_id);
CREATE INDEX idx_sm_status ON state_machines(status);
CREATE INDEX idx_sm_current ON state_machines(current_state);
CREATE INDEX idx_sm_updated ON state_machines(updated_at DESC);
CREATE INDEX idx_sd_machine ON state_definitions(machine_id);
CREATE INDEX idx_sd_name ON state_definitions(state_name);
CREATE INDEX idx_sd_type ON state_definitions(state_type);
CREATE INDEX idx_st_machine ON state_transitions(machine_id);
CREATE INDEX idx_st_from ON state_transitions(from_state);
CREATE INDEX idx_st_to ON state_transitions(to_state);
CREATE INDEX idx_st_event ON state_transitions(event_name);
CREATE INDEX idx_st_active ON state_transitions(is_active) WHERE is_active = true;
CREATE INDEX idx_sh_machine ON state_history(machine_id);
CREATE INDEX idx_sh_created ON state_history(created_at DESC);
CREATE INDEX idx_sh_machine_created ON state_history(machine_id, created_at DESC);
CREATE INDEX idx_sh_from ON state_history(from_state);
CREATE INDEX idx_sh_to ON state_history(to_state);
CREATE INDEX idx_smt_name ON state_machine_templates(name);
CREATE INDEX idx_smt_published ON state_machine_templates(is_published) WHERE is_published = true;
CREATE INDEX idx_smt_usage ON state_machine_templates(usage_count DESC);
