export type MachineStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type StateType = 'initial' | 'normal' | 'final' | 'parallel' | 'history' | 'error';

export type TransitionResult = 'success' | 'guard_failed' | 'invalid_state' | 'no_transition' | 'error';

export type MachineAction = 'start' | 'pause' | 'resume' | 'cancel' | 'reset';

export type HistoryType = 'shallow' | 'deep';

export interface StateMachine {
  id: string;
  name: string;
  agentId?: string;
  currentState: string;
  initialState: string;
  status: MachineStatus;
  context: Record<string, unknown>;
  historyCount: number;
  maxTransitions?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StateDefinition {
  id: string;
  machineId: string;
  stateName: string;
  stateType: StateType;
  onEnterAction?: string;
  onExitAction?: string;
  timeoutMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StateTransition {
  id: string;
  machineId: string;
  fromState: string;
  toState: string;
  eventName: string;
  guardCondition?: string;
  action?: string;
  priority: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StateHistory {
  id: string;
  machineId: string;
  fromState: string;
  toState: string;
  eventName: string;
  transitionId?: string;
  contextSnapshot: Record<string, unknown>;
  durationMs?: number;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StateMachineTemplate {
  id: string;
  name: string;
  description?: string;
  states: unknown[];
  transitions: unknown[];
  initialState: string;
  version: number;
  isPublished: boolean;
  usageCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function isMachineTerminal(m: StateMachine): boolean {
  return m.status === 'completed' || m.status === 'failed' || m.status === 'cancelled';
}

export function canTransition(m: StateMachine): boolean {
  return m.status === 'running';
}

export function transitionCount(history: StateHistory[]): number {
  return history.length;
}
