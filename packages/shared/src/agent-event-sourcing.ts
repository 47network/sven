export type AggregateStatus = 'active' | 'archived' | 'deleted' | 'locked';

export type ProjectionType = 'sync' | 'async' | 'catch_up' | 'live';

export type ProjectionStatus = 'running' | 'paused' | 'rebuilding' | 'error' | 'stopped';

export type ReplayType = 'full' | 'partial' | 'from_snapshot' | 'selective';

export type ReplayStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface EventStoreEntry {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  sequenceNumber: number;
  correlationId?: string;
  causationId?: string;
  createdAt: string;
}

export interface EventAggregate {
  id: string;
  aggregateType: string;
  currentVersion: number;
  status: AggregateStatus;
  lastEventAt?: string;
  snapshotVersion: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventProjection {
  id: string;
  name: string;
  sourceAggregateType: string;
  projectionType: ProjectionType;
  lastProcessedSequence: number;
  status: ProjectionStatus;
  errorMessage?: string;
  lagEvents: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventSnapshot {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: Record<string, unknown>;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EventReplayLog {
  id: string;
  projectionId: string;
  replayType: ReplayType;
  fromSequence: number;
  toSequence: number;
  eventsReplayed: number;
  status: ReplayStatus;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isAggregateActive(agg: EventAggregate): boolean {
  return agg.status === 'active';
}

export function projectionLag(proj: EventProjection): number {
  return proj.lagEvents;
}

export function snapshotSizeMB(snap: EventSnapshot): number {
  return snap.sizeBytes / (1024 * 1024);
}
