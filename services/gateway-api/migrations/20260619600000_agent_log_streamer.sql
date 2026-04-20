-- Batch 323: Log Streamer - Agent log streaming and aggregation
CREATE TABLE IF NOT EXISTS agent_log_streamer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  log_format VARCHAR(50) NOT NULL DEFAULT 'json',
  retention_days INTEGER NOT NULL DEFAULT 30,
  filter_pattern TEXT,
  destination VARCHAR(100) NOT NULL DEFAULT 'opensearch',
  compression_enabled BOOLEAN NOT NULL DEFAULT true,
  sampling_rate DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_log_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_streamer_configs(id),
  stream_name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'application',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  bytes_processed BIGINT NOT NULL DEFAULT 0,
  events_processed BIGINT NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_log_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_log_streamer_configs(id),
  alert_name VARCHAR(255) NOT NULL,
  pattern TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  triggered_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_log_streamer_configs_agent ON agent_log_streamer_configs(agent_id);
CREATE INDEX idx_log_streams_config ON agent_log_streams(config_id);
CREATE INDEX idx_log_alerts_config ON agent_log_alerts(config_id);
