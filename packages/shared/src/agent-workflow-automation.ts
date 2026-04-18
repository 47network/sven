// ---------------------------------------------------------------------------
// Batch 46 — Agent Workflow Automation  (shared types)
// ---------------------------------------------------------------------------

/* ── type unions ───────────────────────────────────────────────────────── */

export type WorkflowTriggerType =
  | 'manual'
  | 'scheduled'
  | 'event'
  | 'webhook'
  | 'task_complete';

export type WorkflowStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived'
  | 'failed';

export type StepType =
  | 'action'
  | 'condition'
  | 'parallel'
  | 'loop'
  | 'delay'
  | 'sub_workflow'
  | 'approval';

export type StepFailurePolicy =
  | 'abort'
  | 'skip'
  | 'retry'
  | 'fallback';

export type RunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export type StepResultStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_approval';

export type TemplateCategory =
  | 'publishing'
  | 'trading'
  | 'research'
  | 'marketing'
  | 'devops'
  | 'onboarding'
  | 'content'
  | 'custom';

/* ── interfaces ───────────────────────────────────────────────────────── */

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string | null;
  ownerAgentId: string;
  triggerType: WorkflowTriggerType;
  status: WorkflowStatus;
  version: number;
  inputSchema: Record<string, unknown> | null;
  tags: string[];
  maxRetries: number;
  timeoutMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  name: string;
  stepType: StepType;
  actionType: string | null;
  config: Record<string, unknown>;
  inputMapping: Record<string, unknown>;
  outputMapping: Record<string, unknown>;
  onFailure: StepFailurePolicy;
  fallbackStepId: string | null;
  timeoutMs: number | null;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  triggeredBy: string;
  runStatus: RunStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  currentStepId: string | null;
  retryCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkflowStepResult {
  id: string;
  runId: string;
  stepId: string;
  stepStatus: StepResultStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  errorMessage: string | null;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  templateData: Record<string, unknown>;
  authorId: string | null;
  usageCount: number;
  rating: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/* ── constants ────────────────────────────────────────────────────────── */

export const WORKFLOW_TRIGGER_TYPES: readonly WorkflowTriggerType[] = [
  'manual', 'scheduled', 'event', 'webhook', 'task_complete',
] as const;

export const WORKFLOW_STATUSES: readonly WorkflowStatus[] = [
  'draft', 'active', 'paused', 'archived', 'failed',
] as const;

export const STEP_TYPES: readonly StepType[] = [
  'action', 'condition', 'parallel', 'loop', 'delay', 'sub_workflow', 'approval',
] as const;

export const RUN_STATUS_ORDER: readonly RunStatus[] = [
  'pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timed_out',
] as const;

export const STEP_FAILURE_POLICIES: readonly StepFailurePolicy[] = [
  'abort', 'skip', 'retry', 'fallback',
] as const;

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  'publishing', 'trading', 'research', 'marketing', 'devops', 'onboarding', 'content', 'custom',
] as const;

/* ── helpers ──────────────────────────────────────────────────────────── */

export function isTerminalRunStatus(s: RunStatus): boolean {
  return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'timed_out';
}

export function canResumeRun(s: RunStatus): boolean {
  return s === 'paused';
}

export function shouldRetryStep(policy: StepFailurePolicy): boolean {
  return policy === 'retry';
}

export function getNextStepOrder(steps: WorkflowStep[]): number {
  if (steps.length === 0) return 1;
  return Math.max(...steps.map((s) => s.stepOrder)) + 1;
}
