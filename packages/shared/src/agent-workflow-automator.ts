export type WorkflowStatus = 'draft' | 'active' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'event' | 'schedule' | 'webhook' | 'condition';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
export type ActionType = 'task' | 'notification' | 'api_call' | 'transform' | 'decision' | 'parallel';

export interface WorkflowAutomatorConfig {
  id: string;
  agentId: string;
  maxConcurrentWorkflows: number;
  retryOnFailure: boolean;
  maxRetries: number;
  timeoutMinutes: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentWorkflow {
  id: string;
  configId: string;
  agentId: string;
  workflowName: string;
  description?: string;
  triggerType: TriggerType;
  status: WorkflowStatus;
  stepCount: number;
  currentStep: number;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepIndex: number;
  stepName: string;
  actionType: ActionType;
  inputConfig: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  status: StepStatus;
  durationMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
