/* Batch 163 — Agent Runtime Sandbox */

export type AgentSandboxType = 'container' | 'wasm' | 'vm' | 'process' | 'namespace';

export type AgentSandboxStatus = 'creating' | 'ready' | 'running' | 'paused' | 'terminated' | 'error';

export type AgentSandboxIsolationLevel = 'minimal' | 'standard' | 'strict' | 'paranoid';

export type AgentSandboxNetworkPolicy = 'none' | 'restricted' | 'internal' | 'full';

export type AgentSandboxViolationType = 'syscall_blocked' | 'memory_exceeded' | 'cpu_exceeded' | 'disk_exceeded' | 'network_blocked' | 'timeout' | 'escape_attempt';

export type AgentSandboxViolationSeverity = 'warning' | 'critical' | 'fatal';

export interface AgentRuntimeSandbox {
  id: string;
  tenantId: string;
  agentId: string;
  sandboxName: string;
  sandboxType: AgentSandboxType;
  resourceLimits: { cpuMs: number; memoryMb: number; diskMb: number; networkKbps: number };
  status: AgentSandboxStatus;
  isolationLevel: AgentSandboxIsolationLevel;
  allowedSyscalls: string[];
  networkPolicy: AgentSandboxNetworkPolicy;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSandboxExecution {
  id: string;
  sandboxId: string;
  command: string;
  exitCode: number | null;
  stdoutSize: number;
  stderrSize: number;
  cpuMsUsed: number;
  memoryPeakMb: number;
  durationMs: number | null;
  killedReason: string | null;
  metadata: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentSandboxViolation {
  id: string;
  sandboxId: string;
  violationType: AgentSandboxViolationType;
  severity: AgentSandboxViolationSeverity;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRuntimeSandboxStats {
  totalSandboxes: number;
  activeSandboxes: number;
  totalExecutions: number;
  totalViolations: number;
  avgCpuMsPerExec: number;
}
