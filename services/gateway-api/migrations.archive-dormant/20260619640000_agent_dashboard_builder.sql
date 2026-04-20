-- Batch 327: Dashboard Builder - Agent dashboard creation and visualization
CREATE TABLE IF NOT EXISTS agent_dashboard_builder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  theme VARCHAR(50) NOT NULL DEFAULT 'dark',
  auto_refresh_seconds INTEGER NOT NULL DEFAULT 30,
  default_time_range VARCHAR(20) NOT NULL DEFAULT '1h',
  layout_type VARCHAR(20) NOT NULL DEFAULT 'grid',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_dashboard_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_dashboard_builder_configs(id),
  title VARCHAR(255) NOT NULL,
  panel_type VARCHAR(50) NOT NULL DEFAULT 'line_chart',
  data_source VARCHAR(100) NOT NULL,
  query TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 6,
  height INTEGER NOT NULL DEFAULT 4,
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_dashboard_builder_configs(id),
  snapshot_name VARCHAR(255) NOT NULL,
  panel_data JSONB NOT NULL,
  time_range_start TIMESTAMPTZ NOT NULL,
  time_range_end TIMESTAMPTZ NOT NULL,
  shared_url VARCHAR(500),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dashboard_builder_configs_agent ON agent_dashboard_builder_configs(agent_id);
CREATE INDEX idx_dashboard_panels_config ON agent_dashboard_panels(config_id);
CREATE INDEX idx_dashboard_snapshots_config ON agent_dashboard_snapshots(config_id);
