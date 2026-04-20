-- Batch 433: Event Sourcer
CREATE TABLE IF NOT EXISTS agent_event_sourcer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  store_backend TEXT NOT NULL DEFAULT 'postgres' CHECK (store_backend IN ('postgres','eventstore','dynamodb','mongodb','cassandra')),
  snapshot_interval INTEGER NOT NULL DEFAULT 100,
  projection_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_event_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_event_sourcer_configs(id),
  stream_name TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_count BIGINT NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','replaying')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_event_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_event_sourcer_configs(id),
  projection_name TEXT NOT NULL,
  last_processed_position BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','rebuilding','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_event_sourcer_configs_agent ON agent_event_sourcer_configs(agent_id);
CREATE INDEX idx_agent_event_streams_config ON agent_event_streams(config_id);
CREATE INDEX idx_agent_event_projections_config ON agent_event_projections(config_id);
