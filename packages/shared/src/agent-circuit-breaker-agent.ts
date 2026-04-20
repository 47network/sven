export type CircuitState = 'closed' | 'open' | 'half_open';
export type CircuitEventType = 'trip' | 'reset' | 'half_open' | 'success' | 'failure';

export interface CircuitBreakerAgentConfig {
  id: string;
  agentId: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
  monitoringWindowMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitBreaker {
  id: string;
  configId: string;
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt?: string;
  nextAttemptAt?: string;
  createdAt: string;
}

export interface CircuitEvent {
  id: string;
  breakerId: string;
  eventType: CircuitEventType;
  fromState: CircuitState;
  toState: CircuitState;
  reason?: string;
  createdAt: string;
}
