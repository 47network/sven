export type ValidationRunStatus = 'running' | 'passed' | 'failed' | 'skipped';
export type ValidationCheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface DeploymentValidatorConfig {
  id: string;
  agentId: string;
  validationTimeoutMs: number;
  requiredChecks: string[];
  failFast: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRun {
  id: string;
  configId: string;
  deploymentId: string;
  status: ValidationRunStatus;
  checksTotal: number;
  checksPassed: number;
  startedAt: string;
  completedAt?: string;
}

export interface ValidationCheck {
  id: string;
  runId: string;
  checkType: string;
  status: ValidationCheckStatus;
  output: Record<string, unknown>;
  durationMs?: number;
  createdAt: string;
}
