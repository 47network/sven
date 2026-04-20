-- Batch 346: Mock Server
CREATE TABLE IF NOT EXISTS agent_mock_server_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  default_port INTEGER DEFAULT 9900,
  record_mode BOOLEAN DEFAULT false,
  latency_simulation BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mock_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_mock_server_configs(id),
  method TEXT NOT NULL,
  path_pattern TEXT NOT NULL,
  response_status INTEGER DEFAULT 200,
  response_body JSONB,
  response_headers JSONB DEFAULT '{}',
  delay_ms INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_mock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES agent_mock_endpoints(id),
  request_method TEXT,
  request_path TEXT,
  request_headers JSONB DEFAULT '{}',
  request_body JSONB,
  matched BOOLEAN DEFAULT true,
  received_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mock_endpoints_config ON agent_mock_endpoints(config_id);
CREATE INDEX idx_mock_requests_endpoint ON agent_mock_requests(endpoint_id);
