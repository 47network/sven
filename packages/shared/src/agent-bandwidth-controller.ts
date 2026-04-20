// Batch 215: Bandwidth Controller — bandwidth allocation and traffic shaping

export type BandwidthPolicyTargetType = 'service' | 'container' | 'network' | 'interface' | 'tenant' | 'agent' | 'global';
export type BandwidthShapingAlgorithm = 'htb' | 'tbf' | 'sfq' | 'fq_codel' | 'cake' | 'hfsc';
export type BandwidthPolicyStatus = 'active' | 'inactive' | 'enforcing' | 'suspended' | 'expired';
export type BandwidthQuotaType = 'daily' | 'weekly' | 'monthly' | 'total' | 'burst';
export type BandwidthOverageAction = 'throttle' | 'block' | 'alert' | 'log' | 'upgrade';
export type BandwidthQuotaStatus = 'active' | 'exceeded' | 'suspended' | 'expired';

export interface AgentBandwidthPolicy {
  id: string;
  agentId: string;
  policyName: string;
  targetType: BandwidthPolicyTargetType;
  targetId: string;
  maxBandwidthMbps: number | null;
  guaranteedBandwidthMbps: number | null;
  burstBandwidthMbps: number | null;
  priority: number;
  shapingAlgorithm: BandwidthShapingAlgorithm;
  status: BandwidthPolicyStatus;
  schedule: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentBandwidthUsage {
  id: string;
  policyId: string;
  measuredAt: string;
  inboundBytes: number;
  outboundBytes: number;
  inboundPackets: number;
  outboundPackets: number;
  avgBandwidthMbps: number | null;
  peakBandwidthMbps: number | null;
  droppedPackets: number;
  throttledConnections: number;
  metadata: Record<string, unknown>;
}

export interface AgentBandwidthQuota {
  id: string;
  agentId: string;
  quotaName: string;
  quotaType: BandwidthQuotaType;
  limitBytes: number;
  usedBytes: number;
  resetAt: string | null;
  overageAction: BandwidthOverageAction;
  overageRateMbps: number | null;
  status: BandwidthQuotaStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
