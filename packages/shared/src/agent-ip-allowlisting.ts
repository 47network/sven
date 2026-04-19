export type IpEnforcementMode = 'enforce' | 'audit' | 'disabled';
export type IpDefaultAction = 'allow' | 'deny';
export type IpRuleAction = 'allow' | 'deny' | 'challenge';

export interface IpAllowlist {
  id: string;
  agentId: string;
  listName: string;
  description: string | null;
  enforcementMode: IpEnforcementMode;
  defaultAction: IpDefaultAction;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IpRule {
  id: string;
  allowlistId: string;
  agentId: string;
  cidr: string;
  label: string | null;
  action: IpRuleAction;
  priority: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface IpAccessLog {
  id: string;
  allowlistId: string;
  agentId: string;
  sourceIp: string;
  matchedRuleId: string | null;
  actionTaken: string;
  requestPath: string | null;
  countryCode: string | null;
  createdAt: string;
}

export interface IpAllowlistingStats {
  totalLists: number;
  activeLists: number;
  totalRules: number;
  totalBlocked: number;
  totalAllowed: number;
}
