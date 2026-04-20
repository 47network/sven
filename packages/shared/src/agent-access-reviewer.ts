export interface AccessReviewerConfig {
  id: string;
  agentId: string;
  reviewScope: string;
  reviewFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  lastReviewAt: string | null;
  findingsCount: number;
  autoRevokeEnabled: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface AccessReviewFinding {
  principalId: string;
  resourceId: string;
  permission: string;
  lastUsed: string | null;
  recommendation: 'keep' | 'revoke' | 'downgrade';
  risk: 'low' | 'medium' | 'high';
}
export interface AccessReviewReport {
  scope: string;
  reviewedAt: string;
  totalPrincipals: number;
  findings: AccessReviewFinding[];
  revokedCount: number;
  downgradedCount: number;
}
