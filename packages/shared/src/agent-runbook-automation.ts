// Batch 179: Agent Runbook Automation Types

export type RunbookCategory = 'operations' | 'incident' | 'deployment' | 'maintenance' | 'security' | 'recovery' | 'scaling';
export type RunbookTriggerType = 'manual' | 'event' | 'schedule' | 'alert' | 'threshold' | 'api';
export type RunbookExecutionStatus = 'pending' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled_back' | 'cancelled';
export type RunbookApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timed_out';

export interface RunbookStep {
  index: number;
  name: string;
  action: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
  timeoutMinutes: number;
  continueOnFailure: boolean;
}

export interface Runbook {
  id: string;
  name: string;
  description: string | null;
  category: RunbookCategory;
  triggerType: RunbookTriggerType;
  triggerConditions: Record<string, unknown>;
  steps: RunbookStep[];
  requiredApprovals: number;
  timeoutMinutes: number;
  rollbackSteps: RunbookStep[];
  version: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RunbookExecution {
  id: string;
  runbookId: string;
  triggeredBy: string | null;
  triggerEvent: string | null;
  status: RunbookExecutionStatus;
  currentStep: number;
  stepResults: Record<string, unknown>[];
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  rollbackExecuted: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RunbookApproval {
  id: string;
  executionId: string;
  stepIndex: number;
  approverAgentId: string | null;
  status: RunbookApprovalStatus;
  approvedAt: string | null;
  comments: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
