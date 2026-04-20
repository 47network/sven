-- Batch 116: Agent Storage Tiering
-- Manages hot/warm/cold/archive storage tiers, lifecycle rules, and data movement

CREATE TABLE IF NOT EXISTS agent_storage_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  tier_name TEXT NOT NULL,
  tier_level TEXT NOT NULL DEFAULT 'hot',
  storage_backend TEXT NOT NULL DEFAULT 'local',
  cost_per_gb_month NUMERIC(10,4) NOT NULL DEFAULT 0,
  max_capacity_gb INT,
  current_usage_gb NUMERIC(12,4) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_storage_lifecycle_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  source_tier_id UUID NOT NULL REFERENCES agent_storage_tiers(id),
  target_tier_id UUID NOT NULL REFERENCES agent_storage_tiers(id),
  age_threshold_days INT NOT NULL DEFAULT 30,
  access_frequency_threshold INT DEFAULT 0,
  file_pattern TEXT DEFAULT '*',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_storage_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES agent_storage_lifecycle_rules(id),
  agent_id UUID NOT NULL,
  source_tier_id UUID NOT NULL REFERENCES agent_storage_tiers(id),
  target_tier_id UUID NOT NULL REFERENCES agent_storage_tiers(id),
  objects_total INT NOT NULL DEFAULT 0,
  objects_migrated INT NOT NULL DEFAULT 0,
  bytes_migrated BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storage_tiers_agent ON agent_storage_tiers(agent_id);
CREATE INDEX IF NOT EXISTS idx_storage_tiers_level ON agent_storage_tiers(tier_level);
CREATE INDEX IF NOT EXISTS idx_storage_lifecycle_agent ON agent_storage_lifecycle_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_storage_lifecycle_source ON agent_storage_lifecycle_rules(source_tier_id);
CREATE INDEX IF NOT EXISTS idx_storage_migrations_agent ON agent_storage_migrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_storage_migrations_status ON agent_storage_migrations(status);
