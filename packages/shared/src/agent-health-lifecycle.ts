/* Batch 44 — Agent Health & Lifecycle shared types */

export type LifecycleHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'critical'
  | 'offline'
  | 'recovering'
  | 'unknown';

export type LifecycleState =
  | 'born'
  | 'initializing'
  | 'active'
  | 'idle'
  | 'hibernating'
  | 'degraded'
  | 'recovering'
  | 'retiring'
  | 'retired'
  | 'terminated';

export type RecoveryAction =
  | 'restart'
  | 'reload_config'
  | 'clear_cache'
  | 'reassign_tasks'
  | 'scale_resources'
  | 'rollback'
  | 'escalate'
  | 'quarantine';

export type LifecycleCheckType =
  | 'heartbeat'
  | 'deep_check'
  | 'dependency_check'
  | 'performance_check'
  | 'memory_check'
  | 'task_throughput';

export type SeverityLevel =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

export interface AgentHealthCheck {
  id: string;
  agentId: string;
  checkType: LifecycleCheckType;
  status: LifecycleHealthStatus;
  severity: SeverityLevel;
  responseMs?: number;
  details: Record<string, unknown>;
  checkedAt: string;
}

export interface AgentLifecycleEvent {
  id: string;
  agentId: string;
  fromState?: LifecycleState;
  toState: LifecycleState;
  reason?: string;
  triggeredBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentHeartbeat {
  id: string;
  agentId: string;
  status: LifecycleHealthStatus;
  cpuPercent?: number;
  memoryMb?: number;
  activeTasks: number;
  uptimeS: number;
  pingedAt: string;
}

export interface AgentRecoveryActionRecord {
  id: string;
  agentId: string;
  healthCheckId?: string;
  actionType: RecoveryAction;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentSlaConfig {
  id: string;
  agentId: string;
  targetUptime: number;
  maxResponseMs: number;
  maxMissedHeartbeats: number;
  checkIntervalMs: number;
  autoRecover: boolean;
  escalationContacts: string[];
}

export const HEALTH_CHECK_INTERVAL_MS = 30_000;
export const MAX_MISSED_HEARTBEATS = 3;
export const RECOVERY_COOLDOWN_MS = 60_000;
export const DEFAULT_SLA_UPTIME = 99.5;
export const SEVERITY_PRIORITY: Record<SeverityLevel, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};
export const LIFECYCLE_ORDER: LifecycleState[] = [
  'born', 'initializing', 'active', 'idle', 'hibernating',
  'degraded', 'recovering', 'retiring', 'retired', 'terminated',
];

export function LifecycleisHealthy(status: LifecycleHealthStatus): boolean {
  return status === 'healthy';
}

export function shouldRecover(status: LifecycleHealthStatus): boolean {
  return status === 'degraded' || status === 'critical' || status === 'offline';
}

export function getRecoveryPriority(severity: SeverityLevel): number {
  return SEVERITY_PRIORITY[severity] ?? 0;
}

export function calculateUptime(totalS: number, downtimeS: number): number {
  if (totalS <= 0) return 100;
  return Math.round(((totalS - downtimeS) / totalS) * 10000) / 100;
}
