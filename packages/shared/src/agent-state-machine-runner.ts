export type MachineStatus = 'idle' | 'running' | 'completed' | 'failed' | 'terminated';

export interface StateMachineRunnerConfig {
  id: string;
  agentId: string;
  maxConcurrentMachines: number;
  historyRetentionDays: number;
  visualizationEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StateMachine {
  id: string;
  configId: string;
  name: string;
  definition: Record<string, unknown>;
  currentState: string;
  context: Record<string, unknown>;
  status: MachineStatus;
  createdAt: string;
}

export interface StateTransition {
  id: string;
  machineId: string;
  fromState: string;
  toState: string;
  eventType: string;
  guardResult?: boolean;
  durationMs?: number;
  createdAt: string;
}
