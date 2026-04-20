-- Batch 326: Trace Collector - Distributed tracing collection and analysis
CREATE TABLE IF NOT EXISTS agent_trace_collector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  sampling_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1,
  max_spans_per_trace INTEGER NOT NULL DEFAULT 1000,
  retention_days INTEGER NOT NULL DEFAULT 14,
  trace_format VARCHAR(50) NOT NULL DEFAULT 'opentelemetry',
  propagation_format VARCHAR(50) NOT NULL DEFAULT 'w3c',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_trace_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_trace_collector_configs(id),
  trace_id VARCHAR(64) NOT NULL,
  span_id VARCHAR(32) NOT NULL,
  parent_span_id VARCHAR(32),
  operation_name VARCHAR(255) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  duration_ms DECIMAL(12,3),
  attributes JSONB DEFAULT '{}',
  events JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_trace_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_trace_collector_configs(id),
  trace_id VARCHAR(64) NOT NULL,
  total_spans INTEGER NOT NULL DEFAULT 0,
  total_duration_ms DECIMAL(12,3),
  bottleneck_span_id VARCHAR(32),
  error_count INTEGER NOT NULL DEFAULT 0,
  analysis_result JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trace_collector_configs_agent ON agent_trace_collector_configs(agent_id);
CREATE INDEX idx_trace_spans_config ON agent_trace_spans(config_id);
CREATE INDEX idx_trace_spans_trace ON agent_trace_spans(trace_id);
CREATE INDEX idx_trace_analyses_config ON agent_trace_analyses(config_id);
