export type ShapingAlgorithm = 'token_bucket' | 'leaky_bucket' | 'weighted_fair' | 'strict_priority';
export type BandwidthTargetType = 'service' | 'agent' | 'subnet' | 'application';
export type BandwidthAllocationStatus = 'active' | 'suspended' | 'exceeded' | 'archived';

export interface AgentBandwidthProfile {
  id: string;
  agentId: string;
  profileName: string;
  maxBandwidthMbps: number | null;
  burstLimitMbps: number | null;
  priorityLevel: number;
  shapingAlgorithm: ShapingAlgorithm;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentBandwidthAllocation {
  id: string;
  profileId: string;
  targetType: BandwidthTargetType;
  targetId: string;
  allocatedMbps: number;
  usedMbpsAvg: number;
  peakMbps: number;
  status: BandwidthAllocationStatus;
  createdAt: string;
}

export interface AgentBandwidthMetric {
  id: string;
  profileId: string;
  measuredAt: string;
  ingressMbps: number;
  egressMbps: number;
  packetLossPct: number;
  jitterMs: number;
  utilizationPct: number;
  metadata: Record<string, unknown>;
}
