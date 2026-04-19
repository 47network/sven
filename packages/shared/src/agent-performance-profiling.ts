/* Batch 162 — Agent Performance Profiling */

export type AgentPerfProfileType = 'cpu' | 'memory' | 'io' | 'network' | 'latency' | 'throughput';

export type AgentPerfBottleneckType =
  | 'cpu_bound'
  | 'memory_leak'
  | 'io_wait'
  | 'lock_contention'
  | 'network_latency'
  | 'gc_pressure'
  | 'queue_backup';

export type AgentPerfSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AgentPerfTrend = 'improving' | 'stable' | 'degrading' | 'critical';

export interface AgentPerfProfile {
  id: string;
  tenantId: string;
  agentId: string;
  profileType: AgentPerfProfileType;
  durationMs: number;
  sampleCount: number;
  hotSpots: unknown[];
  flamegraphUrl: string | null;
  peakValue: number | null;
  avgValue: number | null;
  p99Value: number | null;
  metadata: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentPerfBottleneck {
  id: string;
  profileId: string;
  bottleneckType: AgentPerfBottleneckType;
  severity: AgentPerfSeverity;
  component: string;
  description: string;
  impactPct: number;
  suggestion: string | null;
  autoFixable: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentPerfBaseline {
  id: string;
  agentId: string;
  metricName: string;
  baselineValue: number;
  currentValue: number | null;
  deviationPct: number;
  trend: AgentPerfTrend;
  windowHours: number;
  updatedAt: string;
  createdAt: string;
}

export interface AgentPerformanceProfilingStats {
  totalProfiles: number;
  criticalBottlenecks: number;
  avgDeviationPct: number;
  degradingMetrics: number;
  autoFixableCount: number;
}
