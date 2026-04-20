-- Agent Trace Analyzer tables
CREATE TABLE IF NOT EXISTS agent_trace_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  config_name VARCHAR(255) NOT NULL,
  sampling_rate NUMERIC NOT NULL DEFAULT 1.0 CHECK (sampling_rate >= 0 AND sampling_rate <= 1),
  propagation_type VARCHAR(50) NOT NULL CHECK (propagation_type IN ('w3c','b3','jaeger','zipkin','xray','custom')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','sampling','error','calibrating')),
  exporters JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_trace_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_trace_configs(id),
  trace_id VARCHAR(64) NOT NULL,
  span_id VARCHAR(32) NOT NULL,
  parent_span_id VARCHAR(32),
  operation_name VARCHAR(255) NOT NULL,
  span_kind VARCHAR(20) NOT NULL CHECK (span_kind IN ('server','client','producer','consumer','internal')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('ok','error','unset')),
  duration_ms NUMERIC NOT NULL,
  attributes JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_trace_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('latency','error_rate','throughput','dependency','anomaly','bottleneck')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  results JSONB DEFAULT '{}',
  trace_count INTEGER NOT NULL DEFAULT 0,
  time_range_start TIMESTAMPTZ,
  time_range_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_trace_configs_agent ON agent_trace_configs(agent_id);
CREATE INDEX idx_agent_trace_spans_config ON agent_trace_spans(config_id);
CREATE INDEX idx_agent_trace_spans_trace ON agent_trace_spans(trace_id);
CREATE INDEX idx_agent_trace_analyses_agent ON agent_trace_analyses(agent_id);
