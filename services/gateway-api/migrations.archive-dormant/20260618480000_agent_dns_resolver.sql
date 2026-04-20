-- Batch 211: dns_resolver
CREATE TABLE IF NOT EXISTS agent_dns_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  domain VARCHAR(255) NOT NULL,
  zone_type VARCHAR(30) NOT NULL CHECK (zone_type IN ('primary','secondary','forward','stub','delegation')),
  ttl_seconds INT NOT NULL DEFAULT 3600,
  dnssec_enabled BOOLEAN DEFAULT false,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','propagating','error','suspended','archived')),
  nameservers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, domain)
);

CREATE TABLE IF NOT EXISTS agent_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES agent_dns_zones(id),
  name VARCHAR(255) NOT NULL,
  record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('A','AAAA','CNAME','MX','TXT','SRV','NS','PTR','SOA','CAA')),
  value TEXT NOT NULL,
  ttl_seconds INT DEFAULT 3600,
  priority INT,
  weight INT,
  port INT,
  proxied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_dns_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES agent_dns_zones(id),
  query_name VARCHAR(255) NOT NULL,
  query_type VARCHAR(10) NOT NULL,
  response_code VARCHAR(20) NOT NULL,
  latency_ms NUMERIC(10,3),
  source_ip INET,
  cached BOOLEAN DEFAULT false,
  queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dns_zones_agent ON agent_dns_zones(agent_id);
CREATE INDEX idx_dns_zones_domain ON agent_dns_zones(domain);
CREATE INDEX idx_dns_records_zone ON agent_dns_records(zone_id);
CREATE INDEX idx_dns_records_type ON agent_dns_records(record_type);
CREATE INDEX idx_dns_query_logs_zone ON agent_dns_query_logs(zone_id);
CREATE INDEX idx_dns_query_logs_time ON agent_dns_query_logs(queried_at);
