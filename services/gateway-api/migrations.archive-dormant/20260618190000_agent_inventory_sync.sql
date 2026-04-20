-- Batch 182: Agent Inventory Sync
-- Tracks and synchronizes infrastructure inventory,
-- asset management, and configuration state across environments

CREATE TABLE IF NOT EXISTS agent_inventory_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  provider VARCHAR(100),
  region VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  configuration JSONB DEFAULT '{}',
  tags JSONB DEFAULT '{}',
  cost_per_month NUMERIC(12,4),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_inventory_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,
  target VARCHAR(100) NOT NULL,
  sync_type VARCHAR(50) NOT NULL DEFAULT 'full',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  assets_scanned INTEGER NOT NULL DEFAULT 0,
  assets_added INTEGER NOT NULL DEFAULT 0,
  assets_updated INTEGER NOT NULL DEFAULT 0,
  assets_removed INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_inventory_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES agent_inventory_assets(id),
  sync_job_id UUID REFERENCES agent_inventory_sync_jobs(id),
  change_type VARCHAR(50) NOT NULL,
  field_name VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_assets_type ON agent_inventory_assets(asset_type, environment);
CREATE INDEX idx_inventory_sync_status ON agent_inventory_sync_jobs(status);
CREATE INDEX idx_inventory_changes_asset ON agent_inventory_changes(asset_id);
