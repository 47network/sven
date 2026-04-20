-- Batch 79: Agent Queue Management
-- Tables for managing task queues, priorities, and processing across the agent ecosystem

CREATE TABLE IF NOT EXISTS task_queues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  queue_type TEXT NOT NULL DEFAULT 'fifo' CHECK (queue_type IN ('fifo','lifo','priority','delayed','dead_letter')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draining','archived')),
  max_size INTEGER DEFAULT 10000,
  max_retries INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 5000,
  visibility_timeout_ms INTEGER DEFAULT 30000,
  dlq_queue_id TEXT,
  consumer_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  processing_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  owner_agent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_messages (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES task_queues(id) ON DELETE CASCADE,
  body JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','delayed','dead_letter')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  delay_until TIMESTAMPTZ,
  visible_at TIMESTAMPTZ DEFAULT NOW(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  result JSONB,
  trace_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_consumers (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES task_queues(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','busy','disconnected')),
  batch_size INTEGER DEFAULT 1,
  poll_interval_ms INTEGER DEFAULT 1000,
  messages_processed INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_schedules (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES task_queues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  message_template JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_metrics (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES task_queues(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  enqueued_count INTEGER DEFAULT 0,
  dequeued_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  avg_processing_ms DOUBLE PRECISION DEFAULT 0,
  p95_processing_ms DOUBLE PRECISION DEFAULT 0,
  p99_processing_ms DOUBLE PRECISION DEFAULT 0,
  dlq_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for task_queues
CREATE INDEX idx_task_queues_type ON task_queues(queue_type);
CREATE INDEX idx_task_queues_status ON task_queues(status);
CREATE INDEX idx_task_queues_owner ON task_queues(owner_agent_id);
CREATE INDEX idx_task_queues_created ON task_queues(created_at DESC);

-- Indexes for queue_messages
CREATE INDEX idx_queue_messages_queue ON queue_messages(queue_id);
CREATE INDEX idx_queue_messages_status ON queue_messages(status);
CREATE INDEX idx_queue_messages_priority ON queue_messages(priority DESC);
CREATE INDEX idx_queue_messages_visible ON queue_messages(visible_at);
CREATE INDEX idx_queue_messages_locked ON queue_messages(locked_by);
CREATE INDEX idx_queue_messages_trace ON queue_messages(trace_id);
CREATE INDEX idx_queue_messages_created ON queue_messages(created_at DESC);

-- Indexes for queue_consumers
CREATE INDEX idx_queue_consumers_queue ON queue_consumers(queue_id);
CREATE INDEX idx_queue_consumers_agent ON queue_consumers(agent_id);
CREATE INDEX idx_queue_consumers_status ON queue_consumers(status);
CREATE INDEX idx_queue_consumers_heartbeat ON queue_consumers(last_heartbeat_at);

-- Indexes for queue_schedules
CREATE INDEX idx_queue_schedules_queue ON queue_schedules(queue_id);
CREATE INDEX idx_queue_schedules_enabled ON queue_schedules(enabled);
CREATE INDEX idx_queue_schedules_next ON queue_schedules(next_trigger_at);

-- Indexes for queue_metrics
CREATE INDEX idx_queue_metrics_queue ON queue_metrics(queue_id);
CREATE INDEX idx_queue_metrics_period ON queue_metrics(period_start, period_end);
