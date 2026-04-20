CREATE TABLE IF NOT EXISTS agent_secret_scanner_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  scan_targets JSONB NOT NULL DEFAULT '[]',
  pattern_rules JSONB NOT NULL DEFAULT '[]',
  scan_schedule TEXT NOT NULL DEFAULT '0 */6 * * *',
  severity_threshold TEXT NOT NULL DEFAULT 'medium',
  auto_remediate BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_secret_scanner_configs_agent ON agent_secret_scanner_configs(agent_id);
CREATE INDEX idx_agent_secret_scanner_configs_enabled ON agent_secret_scanner_configs(enabled);
