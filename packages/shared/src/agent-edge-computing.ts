// Batch 108 — Agent Edge Computing types

export type EdgeNodeStatus = 'provisioning' | 'active' | 'draining' | 'offline' | 'decommissioned';
export type EdgeFunctionRuntime = 'javascript' | 'typescript' | 'wasm' | 'python' | 'rust';
export type EdgeFunctionStatus = 'deploying' | 'active' | 'failed' | 'disabled';

export interface EdgeNode {
  id: string;
  agentId: string;
  nodeName: string;
  region: string;
  provider: string;
  status: EdgeNodeStatus;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  ipAddress: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EdgeFunction {
  id: string;
  agentId: string;
  nodeId: string;
  functionName: string;
  runtime: EdgeFunctionRuntime;
  version: number;
  bundleSizeBytes: number;
  memoryLimitMb: number;
  timeoutMs: number;
  invocationsTotal: number;
  avgLatencyMs: number;
  status: EdgeFunctionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EdgeLatencyMetric {
  id: string;
  agentId: string;
  nodeId: string;
  functionId: string | null;
  originRegion: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  sampleCount: number;
  measuredAt: string;
  createdAt: string;
}

export interface EdgeComputingStats {
  totalNodes: number;
  activeNodes: number;
  totalFunctions: number;
  totalInvocations: number;
  avgLatencyMs: number;
}
