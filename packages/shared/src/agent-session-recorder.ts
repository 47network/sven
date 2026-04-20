export type RecordingMode = 'passive' | 'active' | 'selective' | 'full_trace';
export type SessionType = 'interaction' | 'task_execution' | 'collaboration' | 'debug' | 'training';
export type RecordingStatus = 'recording' | 'paused' | 'completed' | 'failed' | 'archived';
export type StorageBackend = 'postgresql' | 'object_store' | 'filesystem' | 'cloud';

export interface SessionRecorderConfig {
  id: string;
  agentId: string;
  recordingMode: RecordingMode;
  retentionDays: number;
  maxSessionDurationMs: number;
  captureInputs: boolean;
  captureOutputs: boolean;
  captureMetadata: boolean;
  storageBackend: StorageBackend;
  compressionEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RecordedSession {
  id: string;
  configId: string;
  agentId: string;
  sessionType: SessionType;
  status: RecordingStatus;
  eventCount: number;
  totalSizeBytes: number;
  durationMs?: number;
  tags: string[];
  startedAt: string;
  endedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: string;
  sequenceNumber: number;
  timestampMs: number;
  payload: Record<string, unknown>;
  sizeBytes: number;
  createdAt: string;
}
