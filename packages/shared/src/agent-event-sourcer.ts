export type EventStoreBackend = 'postgres' | 'eventstore' | 'dynamodb' | 'mongodb' | 'cassandra';
export type StreamStatus = 'active' | 'archived' | 'replaying';
export type ProjectionStatus = 'running' | 'paused' | 'rebuilding' | 'failed';

export interface EventSourcerConfig {
  id: string;
  agentId: string;
  storeBackend: EventStoreBackend;
  snapshotInterval: number;
  projectionEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventStream {
  id: string;
  configId: string;
  streamName: string;
  aggregateType: string;
  eventCount: number;
  lastEventAt?: string;
  status: StreamStatus;
  createdAt: string;
}

export interface EventProjection {
  id: string;
  configId: string;
  projectionName: string;
  lastProcessedPosition: number;
  status: ProjectionStatus;
  errorMessage?: string;
  createdAt: string;
}
