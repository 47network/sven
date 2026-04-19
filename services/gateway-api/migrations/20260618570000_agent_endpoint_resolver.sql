-- Batch 220: Endpoint Resolver
-- Agent-managed service endpoint discovery and resolution

CREATE TABLE IF NOT EXISTS agent_endpoint_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'https' CHECK (protocol IN ('http','https','grpc','ws','wss','tcp','udp')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draining','unhealthy','deregistered')),
  weight INTEGER DEFAULT 100,
  priority INTEGER DEFAULT 0,
  health_check_url TEXT,
  region TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_endpoint_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES agent_endpoint_registrations(id),
  status TEXT NOT NULL CHECK (status IN ('healthy','unhealthy','degraded','timeout')),
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_endpoint_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('weighted','priority','latency','geographic','header_based','canary')),
  conditions JSONB DEFAULT '{}',
  target_endpoints JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_endpoint_reg_agent ON agent_endpoint_registrations(agent_id);
CREATE INDEX idx_endpoint_reg_service ON agent_endpoint_registrations(service_name);
CREATE INDEX idx_endpoint_reg_status ON agent_endpoint_registrations(status);
CREATE INDEX idx_endpoint_health_reg ON agent_endpoint_health_checks(registration_id);
CREATE INDEX idx_endpoint_routing_agent ON agent_endpoint_routing_rules(agent_id);
