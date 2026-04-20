-- Batch 268: Packet Sniffer
CREATE TABLE IF NOT EXISTS agent_sniffer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  sniffer_name VARCHAR(255) NOT NULL,
  interface_name VARCHAR(255) NOT NULL,
  promiscuous_mode BOOLEAN DEFAULT true,
  capture_filter VARCHAR(500),
  max_packet_size INTEGER DEFAULT 65535,
  ring_buffer_mb INTEGER DEFAULT 512,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_sniffer_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_sniffer_configs(id),
  capture_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  packets_count BIGINT DEFAULT 0,
  bytes_count BIGINT DEFAULT 0,
  pcap_path VARCHAR(500),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_sniffer_dissections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES agent_sniffer_captures(id),
  packet_number BIGINT NOT NULL,
  protocol VARCHAR(50),
  source_addr VARCHAR(255),
  dest_addr VARCHAR(255),
  payload_size INTEGER,
  flags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sniffer_configs_agent ON agent_sniffer_configs(agent_id);
CREATE INDEX idx_sniffer_captures_config ON agent_sniffer_captures(config_id);
CREATE INDEX idx_sniffer_dissections_capture ON agent_sniffer_dissections(capture_id);
