-- Batch 214: Packet Analyzer
-- Agent-managed deep packet inspection and traffic analysis

CREATE TABLE IF NOT EXISTS agent_packet_captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    capture_name VARCHAR(255) NOT NULL,
    interface_name VARCHAR(100) NOT NULL,
    filter_expression TEXT,
    capture_format VARCHAR(20) NOT NULL DEFAULT 'pcap' CHECK (capture_format IN ('pcap','pcapng','json','csv','summary')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','capturing','completed','analyzing','failed','archived')),
    packet_count BIGINT NOT NULL DEFAULT 0,
    bytes_captured BIGINT NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    storage_path TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_packet_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capture_id UUID NOT NULL REFERENCES agent_packet_captures(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('protocol_distribution','top_talkers','anomaly_detection','bandwidth_usage','connection_tracking','dns_analysis','tls_inspection','flow_analysis')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    results JSONB NOT NULL DEFAULT '{}',
    summary TEXT,
    findings_count INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_packet_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('alert','block','log','redirect','rate_limit','tag','sample')),
    protocol VARCHAR(20) CHECK (protocol IN ('tcp','udp','icmp','http','https','dns','tls','any')),
    source_filter TEXT,
    destination_filter TEXT,
    port_range VARCHAR(50),
    pattern TEXT,
    action_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    hit_count BIGINT NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 100,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_packet_captures_agent ON agent_packet_captures(agent_id);
CREATE INDEX idx_packet_captures_status ON agent_packet_captures(status);
CREATE INDEX idx_packet_analyses_capture ON agent_packet_analyses(capture_id);
CREATE INDEX idx_packet_analyses_type ON agent_packet_analyses(analysis_type);
CREATE INDEX idx_packet_rules_agent ON agent_packet_rules(agent_id);
CREATE INDEX idx_packet_rules_type ON agent_packet_rules(rule_type);
