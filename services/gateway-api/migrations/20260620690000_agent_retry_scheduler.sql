-- Batch 432: Retry Scheduler
CREATE TABLE IF NOT EXISTS agent_retry_scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_retries INTEGER NOT NULL DEFAULT 5,
  backoff_strategy TEXT NOT NULL DEFAULT 'exponential' CHECK (backoff_strategy IN ('fixed','linear','exponential','fibonacci')),
  base_delay_ms INTEGER NOT NULL DEFAULT 1000,
  max_delay_ms INTEGER NOT NULL DEFAULT 300000,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_retry_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_retry_scheduler_configs(id),
  name TEXT NOT NULL,
  target_service TEXT NOT NULL,
  error_codes TEXT[] DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 3,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_retry_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_retry_policies(id),
  original_request_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retrying','succeeded','exhausted','cancelled')),
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_retry_scheduler_configs_agent ON agent_retry_scheduler_configs(agent_id);
CREATE INDEX idx_agent_retry_policies_config ON agent_retry_policies(config_id);
CREATE INDEX idx_agent_retry_attempts_policy ON agent_retry_attempts(policy_id);
