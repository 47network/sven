export type PoolBackendType = 'postgresql' | 'mysql' | 'redis' | 'http' | 'grpc';
export type PoolStatus = 'active' | 'draining' | 'stopped' | 'error';
export type ConnectionState = 'idle' | 'active' | 'closing' | 'closed';

export interface AgentConnectionPool {
  id: string;
  agentId: string;
  poolName: string;
  backendType: PoolBackendType;
  connectionStringRef: string;
  minConnections: number;
  maxConnections: number;
  idleTimeoutSeconds: number;
  maxLifetimeSeconds: number;
  status: PoolStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPoolConnection {
  id: string;
  poolId: string;
  connectionState: ConnectionState;
  clientId: string | null;
  backendPid: number | null;
  queriesServed: number;
  bytesTransferred: number;
  connectedAt: string;
  lastActivityAt: string;
}

export interface AgentPoolMetric {
  id: string;
  poolId: string;
  measuredAt: string;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  avgQueryTimeMs: number | null;
  poolHitRate: number | null;
  metadata: Record<string, unknown>;
}
