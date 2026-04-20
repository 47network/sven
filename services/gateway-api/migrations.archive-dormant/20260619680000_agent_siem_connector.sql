-- Batch 331: SIEM Connector - Security information and event management integration
CREATE TABLE IF NOT EXISTS agent_siem_connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  siem_type VARCHAR(50) NOT NULL DEFAULT 'opensearch',
  connection_url VARCHAR(500),
  ingestion_rate_limit INTEGER NOT NULL DEFAULT 1000,
  normalization_enabled BOOLEAN NOT NULL DEFAULT true,
  enrichment_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_siem_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_siem_connector_configs(id),
  event_source VARCHAR(255) NOT NULL,
  event_category VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  raw_event JSONB NOT NULL,
  normalized_event JSONB DEFAULT '{}',
  enrichments JSONB DEFAULT '{}',
  correlation_id VARCHAR(64),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_siem_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_siem_connector_configs(id),
  dashboard_name VARCHAR(255) NOT NULL,
  dashboard_type VARCHAR(50) NOT NULL DEFAULT 'threat_overview',
  query_definitions JSONB NOT NULL DEFAULT '[]',
  refresh_interval_seconds INTEGER NOT NULL DEFAULT 60,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_siem_connector_configs_agent ON agent_siem_connector_configs(agent_id);
CREATE INDEX idx_siem_events_config ON agent_siem_events(config_id);
CREATE INDEX idx_siem_dashboards_config ON agent_siem_dashboards(config_id);
