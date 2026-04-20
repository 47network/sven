-- Batch 271: Jitter Analyzer
CREATE TABLE IF NOT EXISTS agent_jitter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  analyzer_name VARCHAR(255) NOT NULL,
  target_host VARCHAR(255) NOT NULL,
  sample_interval_ms INTEGER DEFAULT 100,
  window_size INTEGER DEFAULT 100,
  max_acceptable_ms NUMERIC(10,3) DEFAULT 30.0,
  mos_threshold NUMERIC(3,2) DEFAULT 3.5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_jitter_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_jitter_configs(id),
  jitter_ms NUMERIC(10,3),
  inter_arrival_ms NUMERIC(10,3),
  sequence_number BIGINT,
  direction VARCHAR(10) DEFAULT 'both',
  sampled_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_jitter_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_jitter_configs(id),
  avg_jitter_ms NUMERIC(10,3),
  max_jitter_ms NUMERIC(10,3),
  p95_jitter_ms NUMERIC(10,3),
  mos_score NUMERIC(3,2),
  sample_count INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jitter_configs_agent ON agent_jitter_configs(agent_id);
CREATE INDEX idx_jitter_samples_config ON agent_jitter_samples(config_id);
CREATE INDEX idx_jitter_reports_config ON agent_jitter_reports(config_id);
