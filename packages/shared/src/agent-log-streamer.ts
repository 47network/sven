export type LogFormat = 'json' | 'text' | 'syslog' | 'clf' | 'csv' | 'custom';
export type StreamStatus = 'active' | 'paused' | 'error' | 'terminated';
export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface AgentLogStreamerConfig {
  id: string;
  agentId: string;
  name: string;
  logFormat: LogFormat;
  retentionDays: number;
  filterPattern?: string;
  destination: string;
  compressionEnabled: boolean;
  samplingRate: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentLogStream {
  id: string;
  configId: string;
  streamName: string;
  sourceType: string;
  status: StreamStatus;
  bytesProcessed: number;
  eventsProcessed: number;
  lastEventAt?: Date;
  errorCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentLogAlert {
  id: string;
  configId: string;
  alertName: string;
  pattern: string;
  severity: LogSeverity;
  cooldownMinutes: number;
  triggeredCount: number;
  lastTriggeredAt?: Date;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
