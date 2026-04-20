export type RunbookExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export interface RunbookExecutorConfig {
  id: string;
  agentId: string;
  maxConcurrentRuns: number;
  timeoutSeconds: number;
  sandboxEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Runbook {
  id: string;
  configId: string;
  name: string;
  description: string | null;
  steps: Record<string, unknown>[];
  triggerConditions: Record<string, unknown>;
  version: number;
  createdAt: string;
}

export interface RunbookExecution {
  id: string;
  runbookId: string;
  status: RunbookExecutionStatus;
  currentStep: number;
  stepResults: Record<string, unknown>[];
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
}
