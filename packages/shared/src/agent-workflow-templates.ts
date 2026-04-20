export type WorkflowCategory = 'general' | 'publishing' | 'marketing' | 'development' | 'data' | 'operations' | 'finance' | 'creative';

export type WftWorkflowStatus = 'active' | 'deprecated' | 'draft' | 'archived';

export type WftTriggerType = 'manual' | 'schedule' | 'event' | 'webhook' | 'condition' | 'cron';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export type WftStepResultStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WftWorkflowTemplate {
  id: string;
  name: string;
  category: WorkflowCategory;
  description?: string;
  steps: unknown[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  isPublic: boolean;
  version: string;
  status: WftWorkflowStatus;
  usageCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WftWorkflowStep {
  id: string;
  templateId: string;
  stepOrder: number;
  name: string;
  action: string;
  inputMapping: Record<string, unknown>;
  outputMapping: Record<string, unknown>;
  condition?: Record<string, unknown>;
  retryCount: number;
  timeoutMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowTrigger {
  id: string;
  templateId: string;
  triggerType: WftTriggerType;
  triggerConfig: Record<string, unknown>;
  isActive: boolean;
  lastFiredAt?: string;
  fireCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  triggerId?: string;
  status: ExecutionStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  currentStep: number;
  totalSteps: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WftWorkflowStepResult {
  id: string;
  executionId: string;
  stepId: string;
  status: WftStepResultStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  error?: string;
  attempt: number;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isWorkflowRunning(e: WorkflowExecution): boolean {
  return e.status === 'running';
}

export function workflowProgress(e: WorkflowExecution): number {
  if (e.totalSteps === 0) return 0;
  return e.currentStep / e.totalSteps;
}

export function isStepRetryable(s: WftWorkflowStep, attempt: number): boolean {
  return attempt <= s.retryCount;
}
