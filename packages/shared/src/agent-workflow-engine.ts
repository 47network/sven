export type ExecutionMode = 'sequential' | 'parallel' | 'conditional' | 'event_driven';
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface WorkflowEngineConfig {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  executionMode: ExecutionMode;
  maxConcurrentSteps: number;
  retryPolicy: Record<string, unknown>;
  timeoutSeconds: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDefinition {
  id: string;
  configId: string;
  name: string;
  version: number;
  steps: Record<string, unknown>[];
  triggers: Record<string, unknown>[];
  variables: Record<string, unknown>;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  definitionId: string;
  status: ExecutionStatus;
  currentStep: number;
  stepResults: Record<string, unknown>[];
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}
