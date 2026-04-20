/** Batch 237 — Network Firewall types */

export type FirewallDirection = 'inbound' | 'outbound' | 'both';
export type FirewallProtocol = 'tcp' | 'udp' | 'icmp' | 'any';
export type FirewallAction = 'allow' | 'deny' | 'log';
export type FirewallZoneType = 'trusted' | 'untrusted' | 'dmz' | 'internal' | 'restricted';
export type FirewallZoneStatus = 'active' | 'disabled' | 'testing';

export interface AgentFirewallRule {
  id: string;
  agentId: string;
  ruleName: string;
  direction: FirewallDirection;
  protocol: FirewallProtocol;
  sourceCidr?: string;
  destinationCidr?: string;
  portRange?: string;
  action: FirewallAction;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface AgentFirewallLog {
  id: string;
  ruleId?: string;
  agentId: string;
  sourceIp: string;
  destinationIp: string;
  port?: number;
  protocol?: string;
  actionTaken: string;
  packetSize?: number;
  loggedAt: string;
}

export interface AgentFirewallZone {
  id: string;
  agentId: string;
  zoneName: string;
  zoneType: FirewallZoneType;
  cidrs: string[];
  rules: string[];
  status: FirewallZoneStatus;
  createdAt: string;
}
