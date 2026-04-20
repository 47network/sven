-- Batch 251: Port Scanner
CREATE TABLE IF NOT EXISTS agent_scan_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  target_host TEXT NOT NULL,
  port_range TEXT NOT NULL DEFAULT '1-1024',
  scan_type TEXT NOT NULL CHECK (scan_type IN ('tcp_connect', 'syn', 'udp', 'service_detection', 'os_fingerprint')),
  schedule_cron TEXT,
  last_scan_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES agent_scan_targets(id),
  scan_started_at TIMESTAMPTZ NOT NULL,
  scan_completed_at TIMESTAMPTZ,
  open_ports JSONB DEFAULT '[]',
  closed_ports_count INTEGER DEFAULT 0,
  filtered_ports_count INTEGER DEFAULT 0,
  os_detection TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_port_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES agent_scan_results(id),
  port_number INTEGER NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('tcp', 'udp')),
  state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'filtered', 'open|filtered')),
  service_name TEXT,
  service_version TEXT,
  banner TEXT,
  risk_level TEXT CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scan_targets_agent ON agent_scan_targets(agent_id);
CREATE INDEX idx_scan_results_target ON agent_scan_results(target_id);
CREATE INDEX idx_port_services_result ON agent_port_services(result_id);
