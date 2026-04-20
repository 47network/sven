-- Batch 114: Agent IP Allowlisting
-- Manages IP-based access control lists, CIDR ranges, and geo-restrictions

CREATE TABLE IF NOT EXISTS agent_ip_allowlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  list_name TEXT NOT NULL,
  description TEXT,
  enforcement_mode TEXT NOT NULL DEFAULT 'enforce',
  default_action TEXT NOT NULL DEFAULT 'deny',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ip_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allowlist_id UUID NOT NULL REFERENCES agent_ip_allowlists(id),
  agent_id UUID NOT NULL,
  cidr TEXT NOT NULL,
  label TEXT,
  action TEXT NOT NULL DEFAULT 'allow',
  priority INT NOT NULL DEFAULT 100,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ip_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allowlist_id UUID NOT NULL REFERENCES agent_ip_allowlists(id),
  agent_id UUID NOT NULL,
  source_ip TEXT NOT NULL,
  matched_rule_id UUID,
  action_taken TEXT NOT NULL,
  request_path TEXT,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_allowlists_agent ON agent_ip_allowlists(agent_id);
CREATE INDEX IF NOT EXISTS idx_ip_rules_allowlist ON agent_ip_rules(allowlist_id);
CREATE INDEX IF NOT EXISTS idx_ip_rules_agent ON agent_ip_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_ip_rules_cidr ON agent_ip_rules(cidr);
CREATE INDEX IF NOT EXISTS idx_ip_access_logs_allowlist ON agent_ip_access_logs(allowlist_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_logs_source ON agent_ip_access_logs(source_ip);
