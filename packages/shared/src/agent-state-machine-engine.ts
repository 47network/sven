export type MachineStatus = 'active' | 'paused' | 'completed' | 'error';

export interface StateMachineEngineConfig {
  id: string;
  agentId: string;
  maxMachines: number;
  historyRetentionDays: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentStateMachine {
  id: string;
  configId: string;
  name: string;
  currentState: string;
  definition: Record<string, unknown>;
  context: Record<string, unknown>;
  status: MachineStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StateTransition {
  id: string;
  machineId: string;
  fromState: string;
  toState: string;
  event: string;
  guardResult?: boolean;
  actionOutput?: Record<string, unknown>;
  contextBefore?: Record<string, unknown>;
  contextAfter?: Record<string, unknown>;
  createdAt: Date;
}
