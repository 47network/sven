-- Batch 117: Agent Network Peering
-- Manages VPC/VPN peering connections, routing tables, and transit gateways

CREATE TABLE IF NOT EXISTS agent_peering_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  connection_name TEXT NOT NULL,
  local_network TEXT NOT NULL,
  remote_network TEXT NOT NULL,
  peering_type TEXT NOT NULL DEFAULT 'vpc',
  auth_method TEXT NOT NULL DEFAULT 'psk',
  bandwidth_mbps INT NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'pending',
  established_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_peering_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES agent_peering_connections(id),
  agent_id UUID NOT NULL,
  destination_cidr TEXT NOT NULL,
  next_hop TEXT NOT NULL,
  metric INT NOT NULL DEFAULT 100,
  route_type TEXT NOT NULL DEFAULT 'static',
  propagated BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_transit_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  gateway_name TEXT NOT NULL,
  region TEXT NOT NULL,
  asn BIGINT,
  attached_connections UUID[] NOT NULL DEFAULT '{}',
  max_connections INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'creating',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peering_connections_agent ON agent_peering_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_peering_connections_status ON agent_peering_connections(status);
CREATE INDEX IF NOT EXISTS idx_peering_routes_connection ON agent_peering_routes(connection_id);
CREATE INDEX IF NOT EXISTS idx_peering_routes_agent ON agent_peering_routes(agent_id);
CREATE INDEX IF NOT EXISTS idx_transit_gateways_agent ON agent_transit_gateways(agent_id);
CREATE INDEX IF NOT EXISTS idx_transit_gateways_region ON agent_transit_gateways(region);
