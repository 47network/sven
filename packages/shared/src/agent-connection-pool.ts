// Batch 201: Connection Pool — pool management, health, metrics

export interface ConnectionPool {
  id: string;
  agentId: string;
  poolName: string;
  targetType: ConnectionTargetType;
  targetHost: string;
  targetPort: number;
  minConnections: number;
  maxConnections: number;
  idleTimeoutSeconds: number;
  connectionTimeoutMs: number;
  activeConnections: number;
  idleConnections: number;
  totalCreated: number;
  totalDestroyed: number;
  status: ConnectionPoolStatus;
  metadata: Record<string, unknown>;
}

export interface ConnectionEvent {
  id: string;
  poolId: string;
  eventType: ConnectionEventType;
  connectionId?: string;
  durationMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface ConnectionMetric {
  id: string;
  poolId: string;
  avgWaitMs: number;
  avgUsageMs: number;
  utilizationPct: number;
  errorsCount: number;
  timeoutsCount: number;
  periodStart: string;
  periodEnd: string;
}

export type ConnectionTargetType = 'postgresql' | 'mysql' | 'redis' | 'mongodb' | 'http' | 'grpc' | 'amqp' | 'nats';
export type ConnectionPoolStatus = 'active' | 'draining' | 'paused' | 'error' | 'closed';
export type ConnectionEventType = 'created' | 'destroyed' | 'acquired' | 'released' | 'timeout' | 'error' | 'health_check';
export type ConnectionPoolEvent = 'pool.created' | 'pool.exhausted' | 'pool.health_degraded' | 'pool.connection_error';
