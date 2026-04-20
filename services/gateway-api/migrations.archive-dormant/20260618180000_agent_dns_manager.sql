-- Batch 181: Agent DNS Manager
-- Manages DNS zones, records, health checks,
-- and failover configurations

CREATE TABLE IF NOT EXISTS agent_dns_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  zone_type VARCHAR(50) NOT NULL DEFAULT 'primary',
  provider VARCHAR(100),
  nameservers JSONB DEFAULT '[]',
  dnssec_enabled BOOLEAN NOT NULL DEFAULT false,
  ttl_default INTEGER NOT NULL DEFAULT 3600,
  record_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES agent_dns_zones(id),
  name VARCHAR(255) NOT NULL,
  record_type VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 3600,
  priority INTEGER,
  weight INTEGER,
  port INTEGER,
  proxied BOOLEAN NOT NULL DEFAULT false,
  health_check_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dns_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES agent_dns_records(id),
  check_type VARCHAR(50) NOT NULL DEFAULT 'http',
  endpoint VARCHAR(255) NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 30,
  timeout_seconds INTEGER NOT NULL DEFAULT 10,
  healthy_threshold INTEGER NOT NULL DEFAULT 3,
  unhealthy_threshold INTEGER NOT NULL DEFAULT 2,
  last_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  failover_record_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dns_zones_domain ON agent_dns_zones(domain);
CREATE INDEX idx_dns_records_zone ON agent_dns_records(zone_id, record_type);
CREATE INDEX idx_dns_health_status ON agent_dns_health_checks(last_status);
