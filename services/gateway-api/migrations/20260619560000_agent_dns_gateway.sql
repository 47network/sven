CREATE TABLE IF NOT EXISTS agent_dns_gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  gateway_name TEXT NOT NULL,
  upstream_servers TEXT[] DEFAULT ARRAY['8.8.8.8', '1.1.1.1'],
  cache_ttl INTEGER DEFAULT 300,
  max_cache_entries INTEGER DEFAULT 10000,
  dnssec_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_dns_gateway_configs(id),
  record_name TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'A',
  record_value TEXT NOT NULL,
  ttl INTEGER DEFAULT 300,
  priority INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_dns_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_dns_gateway_configs(id),
  query_name TEXT NOT NULL,
  query_type TEXT NOT NULL,
  response_code TEXT,
  response_time_ms INTEGER,
  cached BOOLEAN DEFAULT false,
  queried_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_dns_records_config ON agent_dns_records(config_id);
CREATE INDEX idx_dns_queries_config ON agent_dns_queries(config_id);
