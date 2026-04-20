-- Batch 222: Traffic Analyzer
-- Agent-managed network traffic analysis and intelligence

CREATE TABLE IF NOT EXISTS agent_traffic_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  source TEXT NOT NULL,
  capture_type TEXT NOT NULL DEFAULT 'realtime' CHECK (capture_type IN ('realtime','scheduled','triggered','retrospective')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  filter_expression TEXT,
  sample_rate NUMERIC DEFAULT 1.0,
  bytes_captured BIGINT DEFAULT 0,
  packets_captured BIGINT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_traffic_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES agent_traffic_captures(id),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('normal','anomaly','attack','bot','crawler','api_abuse','ddos','exfiltration')),
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  source_ips JSONB DEFAULT '[]',
  destination_ips JSONB DEFAULT '[]',
  protocols JSONB DEFAULT '[]',
  description TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_traffic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('summary','detailed','anomaly','compliance','forensic')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_bytes BIGINT DEFAULT 0,
  total_packets BIGINT DEFAULT 0,
  top_sources JSONB DEFAULT '[]',
  top_destinations JSONB DEFAULT '[]',
  protocol_breakdown JSONB DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_traffic_captures_agent ON agent_traffic_captures(agent_id);
CREATE INDEX idx_traffic_captures_status ON agent_traffic_captures(status);
CREATE INDEX idx_traffic_patterns_capture ON agent_traffic_patterns(capture_id);
CREATE INDEX idx_traffic_patterns_type ON agent_traffic_patterns(pattern_type);
CREATE INDEX idx_traffic_reports_agent ON agent_traffic_reports(agent_id);
CREATE INDEX idx_traffic_reports_type ON agent_traffic_reports(report_type);
