-- Batch 304: Stream Ingester
CREATE TABLE IF NOT EXISTS agent_stream_ing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'kafka', consumer_group TEXT,
  auto_offset_reset TEXT NOT NULL DEFAULT 'latest', max_poll_records INTEGER DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_stream_partitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_stream_ing_configs(id),
  topic TEXT NOT NULL, partition_id INTEGER NOT NULL, current_offset BIGINT DEFAULT 0,
  lag BIGINT DEFAULT 0, state TEXT NOT NULL DEFAULT 'consuming', last_poll_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_stream_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_stream_ing_configs(id),
  topic TEXT NOT NULL, partition_id INTEGER NOT NULL, committed_offset BIGINT NOT NULL,
  records_processed BIGINT DEFAULT 0, checkpoint_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stream_ing_configs_agent ON agent_stream_ing_configs(agent_id);
CREATE INDEX idx_stream_partitions_config ON agent_stream_partitions(config_id);
CREATE INDEX idx_stream_checkpoints_config ON agent_stream_checkpoints(config_id);
