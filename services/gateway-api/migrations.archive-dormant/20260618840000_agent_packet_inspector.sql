-- Batch 247: Packet Inspector — deep packet inspection + analysis
CREATE TABLE IF NOT EXISTS agent_inspection_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name VARCHAR(100) NOT NULL,
  inspection_depth VARCHAR(30) DEFAULT 'header',
  protocols TEXT[] DEFAULT '{tcp,udp,http}',
  capture_payload BOOLEAN DEFAULT false,
  max_packet_size INTEGER DEFAULT 1500,
  retention_hours INTEGER DEFAULT 24,
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_packet_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_inspection_policies(id),
  capture_start TIMESTAMPTZ NOT NULL,
  capture_end TIMESTAMPTZ,
  packet_count BIGINT DEFAULT 0,
  bytes_captured BIGINT DEFAULT 0,
  protocol_breakdown JSONB DEFAULT '{}',
  anomalies_detected INTEGER DEFAULT 0,
  storage_path VARCHAR(500),
  status VARCHAR(20) DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_packet_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES agent_packet_captures(id),
  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  source_ip VARCHAR(45),
  destination_ip VARCHAR(45),
  protocol VARCHAR(20),
  description TEXT,
  raw_data JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_insp_policies_agent ON agent_inspection_policies(agent_id);
CREATE INDEX idx_pkt_captures_policy ON agent_packet_captures(policy_id);
CREATE INDEX idx_pkt_anomalies_capture ON agent_packet_anomalies(capture_id);
CREATE INDEX idx_pkt_anomalies_type ON agent_packet_anomalies(anomaly_type);
