/* Batch 160 — Agent Network Policy */

export type AgentNetPolicyType =
  | 'ingress'
  | 'egress'
  | 'internal'
  | 'isolation'
  | 'rate_limit'
  | 'geo_block';

export type AgentNetPolicyAction = 'allow' | 'deny' | 'log' | 'redirect';

export type AgentNetProtocol = 'tcp' | 'udp' | 'http' | 'https' | 'grpc' | 'any';

export type AgentNetSegmentType = 'trusted' | 'dmz' | 'isolated' | 'quarantine' | 'public';

export type AgentNetAuditEventType = 'allowed' | 'denied' | 'logged' | 'rate_limited' | 'geo_blocked';

export interface AgentNetworkPolicyRule {
  id: string;
  tenantId: string;
  policyName: string;
  policyType: AgentNetPolicyType;
  priority: number;
  action: AgentNetPolicyAction;
  sourceSelector: Record<string, unknown>;
  destSelector: Record<string, unknown>;
  protocol: AgentNetProtocol;
  portRange: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentNetworkSegment {
  id: string;
  tenantId: string;
  segmentName: string;
  cidrRange: string;
  segmentType: AgentNetSegmentType;
  vlanId: number | null;
  policies: string[];
  agentCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentNetworkAuditEntry {
  id: string;
  policyId: string | null;
  eventType: AgentNetAuditEventType;
  sourceIp: string | null;
  destIp: string | null;
  protocol: string | null;
  port: number | null;
  agentId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentNetworkPolicyStats {
  totalPolicies: number;
  activeRules: number;
  totalSegments: number;
  deniedRequests: number;
  allowedRequests: number;
}
