-- Batch 97: Agent Rate Limiting
-- Rate limits, quotas, throttle rules, usage tracking, and violation logs

CREATE TABLE IF NOT EXISTS rate_limit_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'agent' CHECK (target_type IN ('agent','service','api','skill','global','ip','user')),
  target_id TEXT,
  requests_per_second INTEGER,
  requests_per_minute INTEGER,
  requests_per_hour INTEGER,
  requests_per_day INTEGER,
  burst_limit INTEGER NOT NULL DEFAULT 10,
  strategy TEXT NOT NULL DEFAULT 'sliding_window' CHECK (strategy IN ('sliding_window','fixed_window','token_bucket','leaky_bucket')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_quotas (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES rate_limit_policies(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('tokens','requests','compute','storage','bandwidth','cost')),
  quota_limit BIGINT NOT NULL,
  quota_used BIGINT NOT NULL DEFAULT 0,
  reset_interval TEXT NOT NULL DEFAULT 'daily' CHECK (reset_interval IN ('hourly','daily','weekly','monthly','never')),
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overage_allowed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS throttle_rules (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES rate_limit_policies(id) ON DELETE CASCADE,
  condition JSONB NOT NULL DEFAULT '{}',
  action TEXT NOT NULL DEFAULT 'delay' CHECK (action IN ('delay','reject','queue','degrade','redirect')),
  delay_ms INTEGER DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_usage_tracking (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES rate_limit_policies(id),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  request_count BIGINT NOT NULL DEFAULT 0,
  token_count BIGINT NOT NULL DEFAULT 0,
  rejected_count BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_violations (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES rate_limit_policies(id),
  violation_type TEXT NOT NULL CHECK (violation_type IN ('rate_exceeded','quota_exhausted','burst_exceeded','throttle_triggered','policy_breach')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical','emergency')),
  details JSONB DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rlp_name ON rate_limit_policies(name);
CREATE INDEX idx_rlp_target ON rate_limit_policies(target_type);
CREATE INDEX idx_rlp_tid ON rate_limit_policies(target_id);
CREATE INDEX idx_rlp_status ON rate_limit_policies(status);
CREATE INDEX idx_rlq_policy ON rate_limit_quotas(policy_id);
CREATE INDEX idx_rlq_resource ON rate_limit_quotas(resource_type);
CREATE INDEX idx_rlq_reset ON rate_limit_quotas(last_reset_at);
CREATE INDEX idx_rlq_created ON rate_limit_quotas(created_at DESC);
CREATE INDEX idx_tr_policy ON throttle_rules(policy_id);
CREATE INDEX idx_tr_action ON throttle_rules(action);
CREATE INDEX idx_tr_active ON throttle_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_tr_priority ON throttle_rules(priority DESC);
CREATE INDEX idx_rut_policy ON rate_usage_tracking(policy_id);
CREATE INDEX idx_rut_window ON rate_usage_tracking(window_start, window_end);
CREATE INDEX idx_rut_count ON rate_usage_tracking(request_count DESC);
CREATE INDEX idx_rut_created ON rate_usage_tracking(created_at DESC);
CREATE INDEX idx_rv_policy ON rate_violations(policy_id);
CREATE INDEX idx_rv_type ON rate_violations(violation_type);
CREATE INDEX idx_rv_severity ON rate_violations(severity);
CREATE INDEX idx_rv_resolved ON rate_violations(resolved) WHERE resolved = false;
