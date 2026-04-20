-- Batch 210: traffic_router
CREATE TABLE IF NOT EXISTS agent_traffic_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  name VARCHAR(255) NOT NULL,
  source_pattern VARCHAR(500) NOT NULL,
  destination VARCHAR(500) NOT NULL,
  method VARCHAR(20) DEFAULT 'ANY',
  priority INT DEFAULT 0,
  weight INT DEFAULT 100,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','canary','shadow','draining','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, name)
);

CREATE TABLE IF NOT EXISTS agent_traffic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES agent_traffic_routes(id),
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('rate_limit','geo_block','header_match','cookie_match','ab_test','circuit_break','retry','timeout')),
  condition JSONB NOT NULL DEFAULT '{}',
  action JSONB NOT NULL DEFAULT '{}',
  priority INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_traffic_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES agent_traffic_routes(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_requests BIGINT DEFAULT 0,
  success_count BIGINT DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  avg_latency_ms NUMERIC(10,3) DEFAULT 0,
  p99_latency_ms NUMERIC(10,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traffic_routes_agent ON agent_traffic_routes(agent_id);
CREATE INDEX idx_traffic_routes_status ON agent_traffic_routes(status);
CREATE INDEX idx_traffic_rules_route ON agent_traffic_rules(route_id);
CREATE INDEX idx_traffic_analytics_route ON agent_traffic_analytics(route_id);
CREATE INDEX idx_traffic_analytics_period ON agent_traffic_analytics(period_start);
