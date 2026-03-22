-- Section 16: Model Governance Tables
-- Manages model registry, deployment policies, canary rollouts, and safety controls

CREATE TABLE IF NOT EXISTS model_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'ollama', 'custom'
  model_identifier TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  parameters JSONB DEFAULT '{}', -- model-specific config
  capabilities JSONB DEFAULT '{}', -- task types supported
  cost_per_1k_tokens DECIMAL(10, 6),
  rate_limit_rpm INT,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sha256_signature TEXT -- for integrity verification
);

ALTER TABLE model_registry
  ADD COLUMN IF NOT EXISTS model_identifier TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '0.0.0',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cost_per_1k_tokens DECIMAL(10, 6),
  ADD COLUMN IF NOT EXISTS rate_limit_rpm INT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sha256_signature TEXT;

CREATE TABLE IF NOT EXISTS model_policies (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  policy_scope TEXT NOT NULL, -- 'global', 'chat', 'user'
  primary_model_id TEXT NOT NULL REFERENCES model_registry(id),
  fallback_model_id TEXT REFERENCES model_registry(id),
  usage_budget_daily DECIMAL(12, 2), -- cost limit per day
  max_tokens_per_request INT,
  temperature_override DECIMAL(3, 2),
  top_p_override DECIMAL(3, 2),
  blocked_token_patterns TEXT[] DEFAULT '{}',
  requires_approval BOOLEAN DEFAULT false,
  approval_workflow_id TEXT REFERENCES workflows(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE model_policies
  ADD COLUMN IF NOT EXISTS chat_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS policy_scope TEXT,
  ADD COLUMN IF NOT EXISTS primary_model_id TEXT,
  ADD COLUMN IF NOT EXISTS fallback_model_id TEXT,
  ADD COLUMN IF NOT EXISTS usage_budget_daily DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS max_tokens_per_request INT,
  ADD COLUMN IF NOT EXISTS temperature_override DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS top_p_override DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS blocked_token_patterns TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_workflow_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS model_canary_rollouts (
  id TEXT PRIMARY KEY,
  source_model_id TEXT NOT NULL REFERENCES model_registry(id),
  target_model_id TEXT NOT NULL REFERENCES model_registry(id),
  rollout_status TEXT NOT NULL, -- 'planning', 'in_progress', 'rolled_back', 'completed'
  total_traffic_percentage INT DEFAULT 0, -- 0-100
  error_threshold_percentage DECIMAL(5, 2) DEFAULT 5.0, -- auto-rollback trigger
  latency_threshold_ms INT, -- auto-rollback if exceeded
  cost_threshold_increase_percentage DECIMAL(5, 2) DEFAULT 50.0, -- cost increase tolerance
  started_at TIMESTAMP,
  expected_completion_at TIMESTAMP,
  rolled_back_at TIMESTAMP,
  rollback_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_rollout_cohorts (
  id TEXT PRIMARY KEY,
  rollout_id TEXT NOT NULL REFERENCES model_canary_rollouts(id) ON DELETE CASCADE,
  cohort_name TEXT NOT NULL,
  traffic_percentage INT, -- % of rollout traffic for this cohort
  chat_ids TEXT[] DEFAULT '{}', -- specific chats in this cohort
  conditions JSONB DEFAULT '{}', -- routing conditions
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_metrics (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
  cohort_id TEXT REFERENCES model_rollout_cohorts(id) ON DELETE SET NULL,
  metric_type TEXT NOT NULL, -- 'latency', 'error_rate', 'cost', 'output_quality'
  value DECIMAL(18, 6) NOT NULL,
  unit TEXT, -- 'ms', '%', 'usd', 'score'
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS model_usage_logs (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES model_registry(id),
  chat_id TEXT REFERENCES chats(id),
  user_id TEXT REFERENCES users(id),
  request_tokens INT,
  response_tokens INT,
  total_cost DECIMAL(12, 6),
  latency_ms INT,
  status TEXT, -- 'success', 'error', 'timeout'
  error_code TEXT,
  output_hash TEXT, -- for dedup/caching
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_approval_requests (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES model_registry(id),
  chat_id TEXT REFERENCES chats(id),
  user_id TEXT REFERENCES users(id),
  request_reason TEXT NOT NULL,
  approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_governance_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL, -- 'model_added', 'policy_created', 'rollout_started', 'rollout_completed', 'rollback'
  actor_id TEXT NOT NULL REFERENCES users(id),
  model_id TEXT REFERENCES model_registry(id),
  policy_id TEXT REFERENCES model_policies(id),
  rollout_id TEXT REFERENCES model_canary_rollouts(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_model_registry_provider_active ON model_registry(provider, is_active);
CREATE INDEX IF NOT EXISTS idx_model_policies_scope_primary ON model_policies(policy_scope, primary_model_id);
CREATE INDEX IF NOT EXISTS idx_model_canary_rollouts_status ON model_canary_rollouts(rollout_status);
CREATE INDEX IF NOT EXISTS idx_model_metrics_model_time ON model_metrics(model_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_model_time ON model_usage_logs(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_approval_requests_status ON model_approval_requests(approval_status, expires_at);
