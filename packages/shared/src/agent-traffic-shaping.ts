// Batch 112 — Agent Traffic Shaping types

export type TrafficDirection = 'ingress' | 'egress' | 'both';
export type TrafficProtocol = 'tcp' | 'udp' | 'icmp' | 'any';
export type TrafficRuleAction = 'shape' | 'throttle' | 'drop' | 'allow' | 'mirror';
export type QosTrafficClass = 'real_time' | 'interactive' | 'bulk' | 'best_effort' | 'scavenger';

export interface TrafficRule {
  id: string;
  agentId: string;
  ruleName: string;
  direction: TrafficDirection;
  protocol: TrafficProtocol;
  sourceCidr: string | null;
  destinationCidr: string | null;
  portRange: string | null;
  action: TrafficRuleAction;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BandwidthLimit {
  id: string;
  agentId: string;
  ruleId: string;
  maxBandwidthMbps: number;
  burstBandwidthMbps: number;
  guaranteedBandwidthMbps: number;
  currentUsageMbps: number;
  throttledCount: number;
  measuredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QosPolicy {
  id: string;
  agentId: string;
  policyName: string;
  trafficClass: QosTrafficClass;
  dscpMarking: number;
  priorityLevel: number;
  maxLatencyMs: number | null;
  maxJitterMs: number | null;
  maxPacketLossPct: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrafficShapingStats {
  totalRules: number;
  activeRules: number;
  totalBandwidthLimits: number;
  totalQosPolicies: number;
  currentThrottledCount: number;
}
