export interface ChangeManagerConfig {
  id: string;
  agentId: string;
  changeType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approvalRequired: boolean;
  rollbackPlan: string | null;
  scheduledAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ChangeRequest {
  id: string;
  type: string;
  description: string;
  riskLevel: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'implementing' | 'completed' | 'rolled_back';
  approvers: string[];
  scheduledAt: string | null;
}
export interface ChangeAuditEntry {
  changeId: string;
  action: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}
