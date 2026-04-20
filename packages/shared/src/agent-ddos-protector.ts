// Batch 240: DDoS Protector types

export type MitigationMode = 'auto' | 'manual' | 'challenge' | 'block' | 'rate_limit';
export type ChallengeType = 'captcha' | 'js_challenge' | 'managed_challenge' | 'none';
export type DdosAttackType = 'volumetric' | 'protocol' | 'application' | 'amplification' | 'slowloris' | 'syn_flood' | 'dns_amplification';
export type DdosIncidentStatus = 'active' | 'mitigating' | 'mitigated' | 'ended';

export interface AgentDdosPolicy {
  id: string;
  agentId: string;
  policyName: string;
  thresholdRps: number;
  thresholdBandwidthMbps: number;
  mitigationMode: MitigationMode;
  challengeType: ChallengeType | null;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDdosIncident {
  id: string;
  policyId: string;
  attackType: DdosAttackType;
  sourceIps: string[];
  peakRps: number | null;
  peakBandwidthMbps: number | null;
  startedAt: string;
  mitigatedAt: string | null;
  endedAt: string | null;
  status: DdosIncidentStatus;
  mitigationActions: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentDdosMetrics {
  id: string;
  policyId: string;
  timestamp: string;
  requestsPerSecond: number;
  bandwidthMbps: number;
  blockedRequests: number;
  challengedRequests: number;
  passedRequests: number;
  uniqueIps: number;
  metadata: Record<string, unknown>;
}
