export type PeeringType = 'vpc' | 'vpn' | 'direct_connect' | 'sd_wan';
export type PeeringAuthMethod = 'psk' | 'certificate' | 'iam' | 'oauth';
export type PeeringConnectionStatus = 'pending' | 'establishing' | 'active' | 'degraded' | 'down';
export type PeeringRouteType = 'static' | 'bgp' | 'ospf';

export interface PeeringConnection {
  id: string;
  agentId: string;
  connectionName: string;
  localNetwork: string;
  remoteNetwork: string;
  peeringType: PeeringType;
  authMethod: PeeringAuthMethod;
  bandwidthMbps: number;
  status: PeeringConnectionStatus;
  establishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeeringRoute {
  id: string;
  connectionId: string;
  agentId: string;
  destinationCidr: string;
  nextHop: string;
  metric: number;
  routeType: PeeringRouteType;
  propagated: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface TransitGateway {
  id: string;
  agentId: string;
  gatewayName: string;
  region: string;
  asn: number | null;
  attachedConnections: string[];
  maxConnections: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkPeeringStats {
  totalConnections: number;
  activeConnections: number;
  totalRoutes: number;
  totalGateways: number;
  totalBandwidthMbps: number;
}
