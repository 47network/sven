CREATE TABLE IF NOT EXISTS agent_data_enricher_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enrichment_sources JSONB NOT NULL DEFAULT '[]',
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  batch_size INTEGER NOT NULL DEFAULT 100,
  rate_limit_per_min INTEGER NOT NULL DEFAULT 1000,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_enricher_configs(id),
  agent_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  records_total INTEGER NOT NULL DEFAULT 0,
  records_enriched INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  enrichment_fields JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_enrichment_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_data_enricher_configs(id),
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'api',
  endpoint_url TEXT,
  auth_config JSONB NOT NULL DEFAULT '{}',
  field_mappings JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_agent ON agent_enrichment_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON agent_enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_sources_config ON agent_enrichment_sources(config_id);
