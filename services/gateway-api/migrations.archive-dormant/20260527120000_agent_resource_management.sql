-- Batch 54 — Agent Resource Management
-- Tracks compute, memory, storage, and network resources consumed by autonomous agents.

CREATE TABLE IF NOT EXISTS agent_resource_pools (
  id              TEXT PRIMARY KEY,
  pool_name       TEXT NOT NULL,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('compute','memory','storage','network','gpu')),
  total_capacity  BIGINT NOT NULL DEFAULT 0,
  allocated       BIGINT NOT NULL DEFAULT 0,
  available       BIGINT NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'bytes',
  region          TEXT NOT NULL DEFAULT 'default',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','degraded','offline','maintenance','draining')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_pools_type ON agent_resource_pools(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_pools_status ON agent_resource_pools(status);
CREATE INDEX IF NOT EXISTS idx_resource_pools_region ON agent_resource_pools(region);

CREATE TABLE IF NOT EXISTS agent_resource_allocations (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  pool_id         TEXT NOT NULL REFERENCES agent_resource_pools(id),
  resource_type   TEXT NOT NULL,
  amount          BIGINT NOT NULL DEFAULT 0,
  priority        INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','allocated','active','releasing','released','failed')),
  requested_at    TIMESTAMPTZ DEFAULT now(),
  allocated_at    TIMESTAMPTZ,
  released_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_alloc_agent ON agent_resource_allocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_pool ON agent_resource_allocations(pool_id);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_status ON agent_resource_allocations(status);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_type ON agent_resource_allocations(resource_type);

CREATE TABLE IF NOT EXISTS agent_resource_quotas (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  max_amount      BIGINT NOT NULL DEFAULT 0,
  current_usage   BIGINT NOT NULL DEFAULT 0,
  soft_limit      BIGINT,
  hard_limit      BIGINT NOT NULL,
  period          TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('hourly','daily','weekly','monthly','unlimited')),
  reset_at        TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_quotas_agent ON agent_resource_quotas(agent_id);
CREATE INDEX IF NOT EXISTS idx_resource_quotas_type ON agent_resource_quotas(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_quotas_period ON agent_resource_quotas(period);

CREATE TABLE IF NOT EXISTS agent_resource_usage_logs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  allocation_id   TEXT REFERENCES agent_resource_allocations(id),
  resource_type   TEXT NOT NULL,
  amount_used     BIGINT NOT NULL DEFAULT 0,
  cost_tokens     NUMERIC(18,6) DEFAULT 0,
  operation       TEXT NOT NULL CHECK (operation IN ('allocate','consume','release','reclaim','scale_up','scale_down')),
  recorded_at     TIMESTAMPTZ DEFAULT now(),
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_resource_usage_agent ON agent_resource_usage_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_alloc ON agent_resource_usage_logs(allocation_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_type ON agent_resource_usage_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_usage_recorded ON agent_resource_usage_logs(recorded_at);

CREATE TABLE IF NOT EXISTS agent_resource_scaling_rules (
  id              TEXT PRIMARY KEY,
  pool_id         TEXT NOT NULL REFERENCES agent_resource_pools(id),
  rule_name       TEXT NOT NULL,
  metric          TEXT NOT NULL CHECK (metric IN ('utilization','queue_depth','latency','error_rate','cost')),
  threshold_up    NUMERIC(10,2) NOT NULL DEFAULT 80.0,
  threshold_down  NUMERIC(10,2) NOT NULL DEFAULT 20.0,
  scale_amount    BIGINT NOT NULL DEFAULT 1,
  cooldown_secs   INTEGER NOT NULL DEFAULT 300,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_triggered  TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_scaling_pool ON agent_resource_scaling_rules(pool_id);
CREATE INDEX IF NOT EXISTS idx_resource_scaling_metric ON agent_resource_scaling_rules(metric);
CREATE INDEX IF NOT EXISTS idx_resource_scaling_enabled ON agent_resource_scaling_rules(enabled);
