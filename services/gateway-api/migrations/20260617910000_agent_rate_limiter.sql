-- Batch 154: Agent Rate Limiter
-- Token-bucket rate limiting for agent actions

CREATE TABLE IF NOT EXISTS agent_rate_limiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  policy TEXT NOT NULL DEFAULT 'token_bucket' CHECK (policy IN ('token_bucket','sliding_window','fixed_window','leaky_bucket')),
  max_tokens INT NOT NULL DEFAULT 100,
  refill_rate INT NOT NULL DEFAULT 10,
  refill_interval_ms INT NOT NULL DEFAULT 1000,
  current_tokens INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limiter_id UUID NOT NULL REFERENCES agent_rate_limiters(id) ON DELETE CASCADE,
  bucket_key TEXT NOT NULL,
  tokens_remaining INT NOT NULL DEFAULT 0,
  last_refill_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limiter_id UUID NOT NULL REFERENCES agent_rate_limiters(id) ON DELETE CASCADE,
  bucket_id UUID REFERENCES rate_limit_buckets(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL,
  action TEXT NOT NULL,
  tokens_requested INT NOT NULL DEFAULT 1,
  tokens_available INT NOT NULL DEFAULT 0,
  retry_after_ms INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limiters_agent ON agent_rate_limiters(agent_id);
CREATE INDEX idx_rate_limiters_policy ON agent_rate_limiters(policy);
CREATE INDEX idx_rate_buckets_limiter ON rate_limit_buckets(limiter_id);
CREATE INDEX idx_rate_buckets_key ON rate_limit_buckets(bucket_key);
CREATE INDEX idx_rate_violations_limiter ON rate_limit_violations(limiter_id);
CREATE INDEX idx_rate_violations_agent ON rate_limit_violations(agent_id);
