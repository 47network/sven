// Batch 352: Topology Mapper types
export type DiscoveryMethod = 'active' | 'passive' | 'hybrid' | 'manual';
export type NodeType = 'service' | 'database' | 'cache' | 'queue' | 'gateway' | 'external';
export type NodeHealth = 'healthy' | 'degraded' | 'down' | 'unknown' | 'maintenance';
export type EdgeType = 'dependency' | 'data_flow' | 'event' | 'replication' | 'fallback';

export interface TopologyMapperConfig {
  id: string;
  agentId: string;
  mapName: string;
  discoveryMethod: DiscoveryMethod;
  scanIntervalSeconds: number;
  includeExternal: boolean;
  depthLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopologyNode {
  id: string;
  configId: string;
  nodeName: string;
  nodeType: NodeType;
  address?: string;
  port?: number;
  healthStatus: NodeHealth;
  metadata: Record<string, unknown>;
  discoveredAt: Date;
  lastSeenAt: Date;
}

export interface TopologyEdge {
  id: string;
  configId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EdgeType;
  protocol?: string;
  latencyMs?: number;
  requestRate?: number;
  metadata: Record<string, unknown>;
  discoveredAt: Date;
}
