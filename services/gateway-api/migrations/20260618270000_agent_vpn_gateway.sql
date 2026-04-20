-- Batch 190: VPN Gateway — secure tunnel management
BEGIN;

CREATE TABLE IF NOT EXISTS agent_vpn_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  vpn_type VARCHAR(50) NOT NULL CHECK (vpn_type IN ('wireguard','openvpn','ipsec','site_to_site','mesh','overlay')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','provisioning','degraded','maintenance')),
  network_cidr VARCHAR(50),
  dns_servers TEXT[],
  max_peers INT DEFAULT 100,
  encryption VARCHAR(50) DEFAULT 'chacha20-poly1305',
  peer_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_vpn_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES agent_vpn_networks(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  peer_type VARCHAR(50) NOT NULL CHECK (peer_type IN ('client','server','relay','gateway','mobile')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blocked','expired','pending')),
  endpoint VARCHAR(255),
  allowed_ips TEXT[],
  public_key VARCHAR(255),
  last_handshake_at TIMESTAMPTZ,
  bytes_sent BIGINT DEFAULT 0,
  bytes_received BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_vpn_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID NOT NULL REFERENCES agent_vpn_peers(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('persistent','on_demand','scheduled','failover','backup')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected','reconnecting','failed','timeout')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  client_ip VARCHAR(45),
  duration_seconds INT,
  data_transferred_bytes BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_vpn_networks_agent ON agent_vpn_networks(agent_id);
CREATE INDEX idx_agent_vpn_peers_network ON agent_vpn_peers(network_id);
CREATE INDEX idx_agent_vpn_sessions_peer ON agent_vpn_sessions(peer_id);
CREATE INDEX idx_agent_vpn_peers_status ON agent_vpn_peers(status);
CREATE INDEX idx_agent_vpn_sessions_status ON agent_vpn_sessions(status);

COMMIT;
