-- Batch 244: VPN Provisioner — WireGuard/OpenVPN tunnel management
CREATE TABLE IF NOT EXISTS agent_vpn_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  vpn_type VARCHAR(20) NOT NULL DEFAULT 'wireguard',
  server_endpoint VARCHAR(255),
  listen_port INTEGER,
  private_key_ref VARCHAR(255),
  address_pool VARCHAR(50),
  dns_servers TEXT[],
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_vpn_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_vpn_configs(id),
  peer_name VARCHAR(100),
  public_key VARCHAR(255) NOT NULL,
  preshared_key_ref VARCHAR(255),
  allowed_ips TEXT[],
  persistent_keepalive INTEGER DEFAULT 25,
  last_handshake TIMESTAMPTZ,
  bytes_received BIGINT DEFAULT 0,
  bytes_sent BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_vpn_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID NOT NULL REFERENCES agent_vpn_peers(id),
  event_type VARCHAR(30) NOT NULL,
  client_ip VARCHAR(45),
  duration_seconds INTEGER,
  bytes_transferred BIGINT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vpn_configs_agent ON agent_vpn_configs(agent_id);
CREATE INDEX idx_vpn_peers_config ON agent_vpn_peers(config_id);
CREATE INDEX idx_vpn_logs_peer ON agent_vpn_connection_logs(peer_id);
