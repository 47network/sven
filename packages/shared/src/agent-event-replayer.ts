// Batch 353: Event Replayer types

export type ReplayMode = 'sequential' | 'parallel' | 'time_scaled' | 'filtered';
export type ReplayStatus = 'idle' | 'replaying' | 'paused' | 'completed' | 'failed';
export type SessionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type EventFilterType = 'include' | 'exclude' | 'regex' | 'jsonpath';

export interface EventReplayerConfig {
  id: string;
  agentId: string;
  name: string;
  sourceStream: string;
  replayMode: ReplayMode;
  speedFactor: number;
  filterPattern: Record<string, unknown>;
  startFrom?: string;
  endAt?: string;
  maxEvents?: number;
  status: ReplayStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReplaySession {
  id: string;
  configId: string;
  sessionStatus: SessionStatus;
  eventsTotal: number;
  eventsReplayed: number;
  eventsSkipped: number;
  eventsFailed: number;
  startedAt?: string;
  completedAt?: string;
  errorLog: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReplayCheckpoint {
  id: string;
  sessionId: string;
  eventOffset: number;
  eventTimestamp: string;
  checkpointData: Record<string, unknown>;
  createdAt: string;
}
