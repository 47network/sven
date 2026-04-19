// Batch 216: Firewall Manager — firewall rules and security policies

export type FirewallRulesetType = 'ingress' | 'egress' | 'internal' | 'dmz' | 'application' | 'network' | 'host';
export type FirewallDefaultAction = 'allow' | 'deny' | 'log' | 'reject';
export type FirewallRulesetStatus = 'active' | 'inactive' | 'testing' | 'audit' | 'disabled';
export type FirewallRuleAction = 'allow' | 'deny' | 'log' | 'reject' | 'rate_limit' | 'redirect' | 'nat';
export type FirewallDirection = 'inbound' | 'outbound' | 'both';
export type FirewallProtocol = 'tcp' | 'udp' | 'icmp' | 'any' | 'sctp' | 'gre' | 'esp';
export type FirewallThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface AgentFirewallRuleset {
  id: string;
  agentId: string;
  rulesetName: string;
  rulesetType: FirewallRulesetType;
  defaultAction: FirewallDefaultAction;
  status: FirewallRulesetStatus;
  priority: number;
  appliedTo: string[];
  ruleCount: number;
  lastEvaluatedAt: string | null;
  evaluationCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFirewallRule {
  id: string;
  rulesetId: string;
  agentId: string;
  ruleName: string;
  action: FirewallRuleAction;
  direction: FirewallDirection;
  protocol: FirewallProtocol | null;
  sourceCidr: string | null;
  destinationCidr: string | null;
  sourcePort: string | null;
  destinationPort: string | null;
  priority: number;
  enabled: boolean;
  hitCount: number;
  lastHitAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFirewallLog {
  id: string;
  ruleId: string | null;
  rulesetId: string;
  actionTaken: string;
  sourceIp: string | null;
  destinationIp: string | null;
  sourcePort: number | null;
  destinationPort: number | null;
  protocol: string | null;
  packetSize: number | null;
  threatLevel: FirewallThreatLevel | null;
  geoSource: string | null;
  metadata: Record<string, unknown>;
  loggedAt: string;
}
