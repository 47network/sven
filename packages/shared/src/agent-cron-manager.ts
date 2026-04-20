export type CronStatus = 'active' | 'paused' | 'disabled' | 'error';
export type CronLogStatus = 'success' | 'failure' | 'timeout' | 'skipped';
export type CronInterval = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface CronManagerConfig {
  id: string;
  agentId: string;
  name: string;
  defaultTimezone: string;
  maxActiveCrons: number;
  notificationOnFailure: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CronEntry {
  id: string;
  configId: string;
  name: string;
  expression: string;
  command: string;
  description?: string;
  timezone: string;
  status: CronStatus;
  lastTriggeredAt?: Date;
  nextTriggerAt?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CronLog {
  id: string;
  entryId: string;
  triggeredAt: Date;
  status: CronLogStatus;
  durationMs?: number;
  output?: string;
  error?: string;
  createdAt: Date;
}
