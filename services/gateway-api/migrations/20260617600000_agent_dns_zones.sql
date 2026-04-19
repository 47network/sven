CREATE TABLE IF NOT EXISTS agent_dns_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  zone_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cloudflare',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended','deleted')),
  dnssec_enabled BOOLEAN NOT NULL DEFAULT false,
  ttl_default INTEGER NOT NULL DEFAULT 3600,
  record_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES agent_dns_zones(id),
  name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('A','AAAA','CNAME','MX','TXT','SRV','NS','CAA','PTR')),
  value TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 3600,
  priority INTEGER,
  proxied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_dns_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES agent_dns_zones(id),
  record_id UUID REFERENCES agent_dns_records(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('create','update','delete','import','export')),
  old_value JSONB,
  new_value JSONB,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dns_zones_agent ON agent_dns_zones(agent_id);
CREATE INDEX idx_dns_zones_name ON agent_dns_zones(zone_name);
CREATE INDEX idx_dns_records_zone ON agent_dns_records(zone_id);
CREATE INDEX idx_dns_records_type ON agent_dns_records(record_type);
CREATE INDEX idx_dns_changes_zone ON agent_dns_change_log(zone_id);
CREATE INDEX idx_dns_changes_type ON agent_dns_change_log(change_type);
