export type LatencyProtocol = 'tcp' | 'udp' | 'icmp' | 'http' | 'https';
export type LatencyTargetStatus = 'active' | 'paused' | 'unreachable' | 'archived';

export interface AgentLatencyTarget {
  id: string;
  agentId: string;
  targetHost: string;
  targetPort: number;
  protocol: LatencyProtocol;
  checkIntervalSeconds: number;
  timeoutMs: number;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLatencyMeasurement {
  id: string;
  targetId: string;
  measuredAt: string;
  latencyMs: number;
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  packetLossPct: number;
  hopCount: number | null;
  metadata: Record<string, unknown>;
}

export interface AgentLatencyBaseline {
  id: string;
  targetId: string;
  baselineMs: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  samples: number;
  computedAt: string;
  metadata: Record<string, unknown>;
}
