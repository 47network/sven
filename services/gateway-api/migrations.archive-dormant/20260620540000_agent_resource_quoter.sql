-- Batch 417: Resource Quoter
CREATE TABLE IF NOT EXISTS agent_resource_quoter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_currency TEXT NOT NULL DEFAULT '47Token',
  quote_validity_seconds INT DEFAULT 3600,
  auto_approve_threshold DOUBLE PRECISION DEFAULT 100.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_resource_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_resource_quoter_configs(id),
  resource_type TEXT NOT NULL,
  resource_spec JSONB NOT NULL DEFAULT '{}',
  estimated_cost DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT '47Token',
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','quoted','approved','rejected','expired','consumed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES agent_resource_quotes(id),
  allocated_resources JSONB NOT NULL DEFAULT '{}',
  actual_cost DOUBLE PRECISION,
  allocated_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_resource_quoter_configs_agent ON agent_resource_quoter_configs(agent_id);
CREATE INDEX idx_resource_quotes_config ON agent_resource_quotes(config_id);
CREATE INDEX idx_resource_quotes_status ON agent_resource_quotes(status);
CREATE INDEX idx_resource_allocations_quote ON agent_resource_allocations(quote_id);
