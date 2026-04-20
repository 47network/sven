-- Batch 180: Agent Network Scanner
-- Scans and maps network topology, discovers services,
-- detects vulnerabilities, and monitors connectivity

CREATE TABLE IF NOT EXISTS agent_network_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type VARCHAR(50) NOT NULL DEFAULT 'discovery',
  target_range VARCHAR(255) NOT NULL,
  protocol VARCHAR(50) NOT NULL DEFAULT 'tcp',
  port_range VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  discovered_hosts INTEGER NOT NULL DEFAULT 0,
  discovered_services INTEGER NOT NULL DEFAULT 0,
  vulnerabilities_found INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  results JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_network_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES agent_network_scans(id),
  ip_address VARCHAR(45) NOT NULL,
  hostname VARCHAR(255),
  mac_address VARCHAR(17),
  os_fingerprint VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'up',
  open_ports JSONB DEFAULT '[]',
  services JSONB DEFAULT '[]',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_network_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES agent_network_hosts(id),
  cve_id VARCHAR(50),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  affected_service VARCHAR(255),
  remediation TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  false_positive BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_scans_status ON agent_network_scans(status);
CREATE INDEX idx_network_hosts_ip ON agent_network_hosts(ip_address);
CREATE INDEX idx_network_vulns_severity ON agent_network_vulnerabilities(severity);
