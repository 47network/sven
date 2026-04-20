-- Batch 388: Integration Connector
CREATE TABLE IF NOT EXISTS agent_integration_connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_connections INT DEFAULT 50,
  retry_policy JSONB DEFAULT '{}',
  timeout_ms INT DEFAULT 30000,
  auth_type TEXT DEFAULT 'api_key',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_integration_connector_configs(id),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  auth_credentials JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','active','error','suspended')),
  last_health_check TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES agent_integrations(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  method TEXT,
  path TEXT,
  status_code INT,
  request_body JSONB,
  response_body JSONB,
  latency_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intg_conn_configs_agent ON agent_integration_connector_configs(agent_id);
CREATE INDEX idx_intg_integrations_config ON agent_integrations(config_id);
CREATE INDEX idx_intg_integrations_status ON agent_integrations(status);
CREATE INDEX idx_intg_logs_integration ON agent_integration_logs(integration_id);
CREATE INDEX idx_intg_logs_created ON agent_integration_logs(created_at);
