// Agent Topology Map — network topology discovery and visualization types

export type TopologyNodeType = 'service' | 'database' | 'cache' | 'queue' | 'gateway' | 'external' | 'storage' | 'compute';
export type TopologyHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type TopologyEdgeType = 'http' | 'grpc' | 'tcp' | 'udp' | 'websocket' | 'nats' | 'redis' | 'postgres';

export interface TopologyNode {
  id: string;
  agentId: string;
  nodeType: TopologyNodeType;
  nodeName: string;
  host?: string;
  port?: number;
  protocol?: string;
  healthStatus: TopologyHealthStatus;
  metadata: Record<string, unknown>;
  discoveredAt: string;
  lastSeenAt: string;
}

export interface TopologyEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: TopologyEdgeType;
  latencyMs?: number;
  bandwidthMbps?: number;
  encrypted: boolean;
  metadata: Record<string, unknown>;
}

export interface TopologySnapshot {
  id: string;
  snapshotName: string;
  nodeCount: number;
  edgeCount: number;
  topologyData: Record<string, unknown>;
  diffFromPrevious?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}
