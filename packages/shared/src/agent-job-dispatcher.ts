export type DispatchStrategy = 'round_robin' | 'least_loaded' | 'priority' | 'affinity' | 'random';
export type JobStatus = 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'retrying' | 'dead_letter';
export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'draining';

export interface JobDispatcherConfig {
  id: string;
  agentId: string;
  maxWorkers: number;
  dispatchStrategy: DispatchStrategy;
  defaultPriority: number;
  jobTimeoutSeconds: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentJob {
  id: string;
  configId: string;
  jobType: string;
  priority: number;
  status: JobStatus;
  assignedWorkerId?: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error?: string;
  dispatchedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface JobWorker {
  id: string;
  configId: string;
  workerAgentId: string;
  status: WorkerStatus;
  capabilities: string[];
  currentLoad: number;
  maxLoad: number;
  lastHeartbeatAt: Date;
  createdAt: Date;
}
