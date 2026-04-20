export type VpnType = 'wireguard' | 'openvpn' | 'ipsec' | 'l2tp';
export type VpnStatus = 'active' | 'inactive' | 'provisioning' | 'error';
export type VpnEventType = 'connected' | 'disconnected' | 'handshake' | 'error' | 'key_rotated';

export interface AgentVpnConfig {
  id: string;
  agentId: string;
  vpnType: VpnType;
  serverEndpoint: string | null;
  listenPort: number | null;
  privateKeyRef: string;
  addressPool: string;
  dnsServers: string[];
  status: VpnStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentVpnPeer {
  id: string;
  configId: string;
  peerName: string;
  publicKey: string;
  presharedKeyRef: string | null;
  allowedIps: string[];
  persistentKeepalive: number;
  lastHandshake: string | null;
  bytesReceived: number;
  bytesSent: number;
  status: string;
  createdAt: string;
}

export interface AgentVpnConnectionLog {
  id: string;
  peerId: string;
  eventType: VpnEventType;
  clientIp: string | null;
  durationSeconds: number | null;
  bytesTransferred: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
