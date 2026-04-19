// Agent Access Review — periodic access rights review and certification types

export type AccessCampaignType = 'periodic' | 'triggered' | 'certification' | 'audit' | 'emergency';
export type AccessCampaignStatus = 'draft' | 'active' | 'in_review' | 'completed' | 'cancelled';
export type AccessPermissionLevel = 'read' | 'write' | 'admin' | 'execute' | 'delete' | 'full';
export type AccessEntryStatus = 'pending_review' | 'approved' | 'revoked' | 'flagged' | 'exempted';
export type AccessPolicyType = 'rbac' | 'abac' | 'time_based' | 'location_based' | 'risk_based' | 'custom';
export type AccessEnforcementMode = 'enforce' | 'audit' | 'disabled';

export interface AccessCampaign {
  id: string;
  campaignName: string;
  campaignType: AccessCampaignType;
  status: AccessCampaignStatus;
  scopeFilter: Record<string, unknown>;
  reviewerAgentId?: string;
  totalEntries: number;
  reviewedCount: number;
  approvedCount: number;
  revokedCount: number;
  startedAt?: string;
  deadlineAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export interface AccessEntry {
  id: string;
  campaignId: string;
  subjectAgentId: string;
  resourceType: string;
  resourceName: string;
  permissionLevel: AccessPermissionLevel;
  currentStatus: AccessEntryStatus;
  riskScore: number;
  lastUsedAt?: string;
  reviewerNotes?: string;
  reviewedAt?: string;
  metadata: Record<string, unknown>;
}

export interface AccessPolicy {
  id: string;
  policyName: string;
  policyType: AccessPolicyType;
  rules: Array<Record<string, unknown>>;
  enforcementMode: AccessEnforcementMode;
  priority: number;
  active: boolean;
  metadata: Record<string, unknown>;
}
