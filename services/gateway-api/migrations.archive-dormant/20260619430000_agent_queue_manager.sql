-- Batch 306: Queue Manager
CREATE TABLE IF NOT EXISTS agent_queue_mgr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  queue_type TEXT NOT NULL DEFAULT 'fifo', max_size INTEGER DEFAULT 100000,
  visibility_timeout_seconds INTEGER DEFAULT 30, retention_hours INTEGER DEFAULT 168,
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_queue_mgr_configs(id),
  queue_name TEXT NOT NULL, depth INTEGER DEFAULT 0,
  in_flight INTEGER DEFAULT 0, consumers INTEGER DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_queue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), queue_id UUID NOT NULL REFERENCES agent_queues(id),
  enqueued BIGINT DEFAULT 0, dequeued BIGINT DEFAULT 0, failed BIGINT DEFAULT 0,
  avg_latency_ms DOUBLE PRECISION DEFAULT 0, max_depth INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_queue_mgr_configs_agent ON agent_queue_mgr_configs(agent_id);
CREATE INDEX idx_queues_config ON agent_queues(config_id);
CREATE INDEX idx_queue_metrics_queue ON agent_queue_metrics(queue_id);
