-- Batch 203: Stream Processor
-- Real-time data stream processing and transformation

CREATE TABLE IF NOT EXISTS agent_stream_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('kafka','nats','redis_stream','websocket','http_sse','file_tail','mqtt','amqp')),
  connection_config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','error','draining','paused')),
  throughput_rps NUMERIC(12,2) DEFAULT 0,
  last_offset VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_stream_transforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES agent_stream_sources(id),
  name VARCHAR(255) NOT NULL,
  transform_type VARCHAR(50) NOT NULL CHECK (transform_type IN ('filter','map','reduce','aggregate','join','window','enrich','deduplicate')),
  config JSONB NOT NULL DEFAULT '{}',
  ordering INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_stream_sinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES agent_stream_sources(id),
  name VARCHAR(255) NOT NULL,
  sink_type VARCHAR(50) NOT NULL CHECK (sink_type IN ('postgresql','opensearch','s3','kafka','nats','http_webhook','file','redis')),
  connection_config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','error','paused')),
  messages_delivered BIGINT DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_sources_agent ON agent_stream_sources(agent_id);
CREATE INDEX idx_stream_sources_status ON agent_stream_sources(status);
CREATE INDEX idx_stream_transforms_source ON agent_stream_transforms(source_id);
CREATE INDEX idx_stream_sinks_source ON agent_stream_sinks(source_id);
