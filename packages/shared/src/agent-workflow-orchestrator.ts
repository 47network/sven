export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type StepType = 'action' | 'condition' | 'parallel' | 'loop' | 'wait' | 'subprocess';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ErrorHandling = 'retry' | 'skip' | 'abort' | 'fallback';

export interface WorkflowOrchestratorConfig {
  id: string;
  agentId: string;
  maxConcurrentWorkflows: number;
  defaultTimeoutSeconds: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  errorHandling: ErrorHandling;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentWorkflow {
  id: string;
  configId: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  definition: Record<string, unknown>;
  context: Record<string, unknown>;
  currentStep?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepName: string;
  stepType: StepType;
  status: StepStatus;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  error?: string;
  retries: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
