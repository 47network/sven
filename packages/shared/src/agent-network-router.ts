export type RoutingAlgorithm = 'round_robin' | 'weighted' | 'least_connections' | 'ip_hash' | 'geo_based';
export type RouteStatus = 'active' | 'inactive' | 'blackholed' | 'draining';
export type PolicyAction = 'forward' | 'drop' | 'reject' | 'redirect' | 'mirror';

export interface AgentNetworkRouterConfig {
  id: string;
  agentId: string;
  routerName: string;
  protocol: string;
  routingAlgorithm: RoutingAlgorithm;
  maxRoutes: number;
  healthCheckInterval: number;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentNetworkRoute {
  id: string;
  configId: string;
  destination: string;
  gateway: string | null;
  metric: number;
  status: RouteStatus;
  trafficCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AgentNetworkPolicy {
  id: string;
  configId: string;
  policyName: string;
  policyType: string;
  sourceCidr: string | null;
  destCidr: string | null;
  priority: number;
  action: PolicyAction;
  enabled: boolean;
  createdAt: string;
}
