CREATE TABLE IF NOT EXISTS agent_infra_scanner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  scan_scope TEXT NOT NULL,
  scan_type VARCHAR(100) NOT NULL,
  severity_threshold VARCHAR(50) DEFAULT 'medium',
  last_scan_at TIMESTAMPTZ,
  findings_count INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_infra_scanner_configs_agent ON agent_infra_scanner_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_infra_scanner_configs_enabled ON agent_infra_scanner_configs(enabled);
