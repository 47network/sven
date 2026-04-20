CREATE TABLE IF NOT EXISTS agent_service_catalog_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  service_name VARCHAR(500) NOT NULL,
  service_tier VARCHAR(50) DEFAULT 'standard',
  owner_team VARCHAR(200),
  dependencies JSONB DEFAULT '[]',
  documentation_url TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_service_catalog_configs_agent ON agent_service_catalog_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_service_catalog_configs_enabled ON agent_service_catalog_configs(enabled);
