/* Batch 190 — VPN Gateway shared types */

export type VpnNetworkType = 'wireguard' | 'openvpn' | 'ipsec' | 'site_to_site' | 'mesh' | 'overlay';
export type VpnNetworkStatus = 'active' | 'disabled' | 'provisioning' | 'degraded' | 'maintenance';
export type VpnPeerType = 'client' | 'server' | 'relay' | 'gateway' | 'mobile';
export type VpnPeerStatus = 'active' | 'inactive' | 'blocked' | 'expired' | 'pending';
export type VpnSessionType = 'persistent' | 'on_demand' | 'scheduled' | 'failover' | 'backup';
export type VpnSessionStatus = 'active' | 'disconnected' | 'reconnecting' | 'failed' | 'timeout';

export interface VpnNetwork {
  id: string;
  agent_id: string;
  name: string;
  vpn_type: VpnNetworkType;
  status: VpnNetworkStatus;
  network_cidr?: string;
  dns_servers: string[];
  max_peers: number;
  encryption: string;
  peer_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VpnPeer {
  id: string;
  network_id: string;
  name: string;
  peer_type: VpnPeerType;
  status: VpnPeerStatus;
  endpoint?: string;
  allowed_ips: string[];
  public_key?: string;
  last_handshake_at?: string;
  bytes_sent: number;
  bytes_received: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VpnSession {
  id: string;
  peer_id: string;
  session_type: VpnSessionType;
  status: VpnSessionStatus;
  connected_at: string;
  disconnected_at?: string;
  client_ip?: string;
  duration_seconds?: number;
  data_transferred_bytes: number;
  metadata: Record<string, unknown>;
  created_at: string;
}
