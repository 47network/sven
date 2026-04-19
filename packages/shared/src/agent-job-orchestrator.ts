export type RetryStrategy = 'exponential' | 'linear' | 'fixed' | 'none';
export type OrchJobStatus = 'queued' | 'waiting' | 'running' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';
export type DependencyType = 'completion' | 'success' | 'any';

export interface JobOrchestratorConfig {
  id: string;
  agentId: string;
  name: string;
  concurrencyLimit: number;
  priorityLevels: number;
  deadLetterEnabled: boolean;
  retryStrategy: RetryStrategy;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrchestratedJob {
  id: string;
  configId: string;
  name: string;
  jobType: string;
  priority: number;
  payload: Record<string, unknown>;
  dependencies: string[];
  status: OrchJobStatus;
  assignedWorker?: string;
  startedAt?: Date;
  completedAt?: Date;
  result: Record<string, unknown>;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: Date;
}

export interface JobDependency {
  id: string;
  jobId: string;
  dependsOnJobId: string;
  dependencyType: DependencyType;
  createdAt: Date;
}
