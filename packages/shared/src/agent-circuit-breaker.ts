export type AgentCircuitState = 'closed' | 'open' | 'half_open';
export type CircuitTripType = 'open' | 'half_open' | 'close' | 'reset';

export interface AgentCircuitConfig {
  id: string;
  agentId: string;
  targetAgentId: string;
  name: string;
  state: AgentCircuitState;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  openedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCircuitTrip {
  id: string;
  breakerId: string;
  tripType: CircuitTripType;
  reason: string | null;
  failureCount: number;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CircuitBreakerMetric {
  id: string;
  breakerId: string;
  windowStart: string;
  windowEnd: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  avgLatencyMs: number | null;
  p99LatencyMs: number | null;
  createdAt: string;
}

export interface AgentCircuitStats {
  totalBreakers: number;
  closedBreakers: number;
  openBreakers: number;
  halfOpenBreakers: number;
  totalTrips: number;
  avgFailureRate: number;
}
