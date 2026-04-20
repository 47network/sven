-- Batch 99: Agent DNS Management
CREATE TABLE IF NOT EXISTS agent_dns_zones (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'internal',
  nameservers JSONB NOT NULL DEFAULT '[]',
  dnssec_enabled BOOLEAN NOT NULL DEFAULT false,
  ttl_default INTEGER NOT NULL DEFAULT 3600,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dns_records (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES agent_dns_zones(id),
  record_name TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'A',
  record_value TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 3600,
  priority INTEGER,
  proxied BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dns_changes (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES agent_dns_zones(id),
  record_id TEXT REFERENCES agent_dns_records(id),
  change_type TEXT NOT NULL DEFAULT 'create',
  old_value JSONB,
  new_value JSONB,
  propagation_status TEXT NOT NULL DEFAULT 'pending',
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dns_zones_agent ON agent_dns_zones(agent_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_zone ON agent_dns_records(zone_id);
CREATE INDEX IF NOT EXISTS idx_dns_changes_zone ON agent_dns_changes(zone_id);
