export enum IsolationLevel {
  Container = 'container',
  VM = 'vm',
  Namespace = 'namespace',
  Process = 'process',
  Wasm = 'wasm',
}

export enum SandboxStatus {
  Provisioning = 'provisioning',
  Running = 'running',
  Paused = 'paused',
  Terminated = 'terminated',
  Failed = 'failed',
}

export enum NetworkPolicy {
  Restricted = 'restricted',
  InternalOnly = 'internal_only',
  EgressOnly = 'egress_only',
  Full = 'full',
  None = 'none',
}

export enum ViolationType {
  ResourceExceeded = 'resource_exceeded',
  NetworkBreach = 'network_breach',
  FsEscape = 'fs_escape',
  SyscallBlocked = 'syscall_blocked',
  Timeout = 'timeout',
}

export interface SandboxEnvironment {
  id: string;
  agentId: string;
  name: string;
  isolationLevel: IsolationLevel;
  status: SandboxStatus;
  resourceLimits: Record<string, string>;
  networkPolicy: NetworkPolicy;
  ttlSeconds: number | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface SandboxExecution {
  id: string;
  sandboxId: string;
  command: string;
  exitCode: number | null;
  stdoutSize: number;
  stderrSize: number;
  durationMs: number | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface SandboxViolation {
  id: string;
  sandboxId: string;
  violationType: ViolationType;
  severity: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SandboxIsolationStats {
  totalSandboxes: number;
  runningSandboxes: number;
  totalExecutions: number;
  totalViolations: number;
  avgExecutionMs: number;
}
