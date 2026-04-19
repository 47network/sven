export type MeshRoutingPolicy = 'round_robin' | 'weighted' | 'latency' | 'priority' | 'failover' | 'broadcast';
export type RouteHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface MeshRouteTable {
  id: string;
  agentId: string;
  name: string;
  policy: MeshRoutingPolicy;
  active: boolean;
  routeCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MeshRouteEntry {
  id: string;
  tableId: string;
  destinationAgentId: string;
  pattern: string;
  weight: number;
  priority: number;
  healthy: boolean;
  latencyMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MeshRouteLog {
  id: string;
  tableId: string;
  entryId: string | null;
  sourceAgentId: string;
  destinationAgentId: string | null;
  pattern: string;
  routed: boolean;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface MeshRoutingStats {
  totalTables: number;
  activeTables: number;
  totalRoutes: number;
  healthyRoutes: number;
  avgLatencyMs: number;
  routedCount: number;
  failedCount: number;
}
