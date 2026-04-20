-- Batch 92: Agent Distributed Tracing
-- Traces, spans, baggage, sampling rules, and trace analytics

CREATE TABLE IF NOT EXISTS trace_records (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','timeout','cancelled','unset')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  root_span_id TEXT,
  span_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trace_spans (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT,
  name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  span_kind TEXT NOT NULL DEFAULT 'internal' CHECK (span_kind IN ('internal','server','client','producer','consumer')),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','timeout','cancelled','unset')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms BIGINT,
  attributes JSONB DEFAULT '{}',
  events JSONB DEFAULT '[]',
  links JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trace_baggage (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trace_id, key)
);

CREATE TABLE IF NOT EXISTS trace_sampling_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service_pattern TEXT,
  operation_pattern TEXT,
  sample_rate NUMERIC NOT NULL DEFAULT 1.0 CHECK (sample_rate >= 0 AND sample_rate <= 1),
  max_traces_per_second INTEGER,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trace_analytics (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_traces BIGINT NOT NULL DEFAULT 0,
  error_traces BIGINT NOT NULL DEFAULT 0,
  avg_duration_ms NUMERIC,
  p50_duration_ms NUMERIC,
  p95_duration_ms NUMERIC,
  p99_duration_ms NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tr_trace ON trace_records(trace_id);
CREATE INDEX idx_tr_service ON trace_records(service_name);
CREATE INDEX idx_tr_status ON trace_records(status);
CREATE INDEX idx_tr_start ON trace_records(start_time DESC);
CREATE INDEX idx_ts_trace ON trace_spans(trace_id);
CREATE INDEX idx_ts_parent ON trace_spans(parent_span_id);
CREATE INDEX idx_ts_service ON trace_spans(service_name);
CREATE INDEX idx_ts_kind ON trace_spans(span_kind);
CREATE INDEX idx_ts_status ON trace_spans(status);
CREATE INDEX idx_ts_start ON trace_spans(start_time DESC);
CREATE INDEX idx_ts_duration ON trace_spans(duration_ms DESC);
CREATE INDEX idx_tb_trace ON trace_baggage(trace_id);
CREATE INDEX idx_tb_key ON trace_baggage(key);
CREATE INDEX idx_tsr_name ON trace_sampling_rules(name);
CREATE INDEX idx_tsr_service ON trace_sampling_rules(service_pattern);
CREATE INDEX idx_tsr_active ON trace_sampling_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_tsr_priority ON trace_sampling_rules(priority DESC);
CREATE INDEX idx_ta_service ON trace_analytics(service_name);
CREATE INDEX idx_ta_operation ON trace_analytics(operation);
CREATE INDEX idx_ta_period ON trace_analytics(period_start, period_end);
