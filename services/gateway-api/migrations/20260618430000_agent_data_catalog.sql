-- Batch 206: Data Catalog
-- Metadata management, data asset discovery, lineage tracking

CREATE TABLE IF NOT EXISTS agent_data_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('table','view','stream','file','api_endpoint','model','dashboard','report','dataset')),
  source_system VARCHAR(255),
  schema_info JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  owner_agent_id UUID REFERENCES agents(id),
  quality_score NUMERIC(5,2) CHECK (quality_score >= 0 AND quality_score <= 100),
  last_profiled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_data_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_asset_id UUID NOT NULL REFERENCES agent_data_assets(id),
  target_asset_id UUID NOT NULL REFERENCES agent_data_assets(id),
  transformation_type VARCHAR(50) NOT NULL CHECK (transformation_type IN ('copy','filter','aggregate','join','derive','enrich','mask','sample')),
  transformation_config JSONB DEFAULT '{}',
  pipeline_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_data_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES agent_data_assets(id),
  row_count BIGINT,
  column_count INT,
  size_bytes BIGINT,
  null_percentage JSONB DEFAULT '{}',
  unique_counts JSONB DEFAULT '{}',
  value_distributions JSONB DEFAULT '{}',
  anomalies JSONB DEFAULT '[]',
  profiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_assets_agent ON agent_data_assets(agent_id);
CREATE INDEX idx_data_assets_type ON agent_data_assets(asset_type);
CREATE INDEX idx_data_assets_tags ON agent_data_assets USING GIN(tags);
CREATE INDEX idx_data_lineage_source ON agent_data_lineage(source_asset_id);
CREATE INDEX idx_data_lineage_target ON agent_data_lineage(target_asset_id);
CREATE INDEX idx_data_profiles_asset ON agent_data_profiles(asset_id);
