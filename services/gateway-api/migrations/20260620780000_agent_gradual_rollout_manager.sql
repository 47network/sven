-- Batch 441: Gradual Rollout Manager
CREATE TABLE IF NOT EXISTS agent_gradual_rollout_manager_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_increment INTEGER NOT NULL DEFAULT 10,
  observation_window_ms INTEGER NOT NULL DEFAULT 300000,
  error_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_gradual_rollout_manager_configs(id),
  feature_key TEXT NOT NULL,
  current_percentage INTEGER NOT NULL DEFAULT 0,
  target_percentage INTEGER NOT NULL DEFAULT 100,
  increment INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rolling','paused','completed','rolled_back')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_rollout_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollout_id UUID NOT NULL REFERENCES agent_rollouts(id),
  from_percentage INTEGER NOT NULL,
  to_percentage INTEGER NOT NULL,
  error_rate NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_agent_gradual_rollout_manager_configs_agent ON agent_gradual_rollout_manager_configs(agent_id);
CREATE INDEX idx_agent_rollouts_config ON agent_rollouts(config_id);
CREATE INDEX idx_agent_rollout_steps_rollout ON agent_rollout_steps(rollout_id);
