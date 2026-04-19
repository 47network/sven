/* Batch 135 — Agent Change Management types */

export type ChangeRequestType = 'feature' | 'bugfix' | 'hotfix' | 'config' | 'infrastructure' | 'security';
export type ChangeRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'rolled_back' | 'cancelled';
export type ChangeRequestPriority = 'critical' | 'high' | 'medium' | 'low';
export type ChangeDecision = 'approved' | 'rejected' | 'needs_info';
export type RollbackType = 'full' | 'partial' | 'config_only';

export interface ChangeRequest {
  id: string;
  title: string;
  description?: string;
  requestType: ChangeRequestType;
  status: ChangeRequestStatus;
  priority: ChangeRequestPriority;
  requesterId?: string;
  assigneeId?: string;
  affectedServices: string[];
  impactAnalysis: Record<string, unknown>;
  rollbackPlan?: string;
  metadata: Record<string, unknown>;
  submittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeApproval {
  id: string;
  changeId: string;
  approverId: string;
  decision: ChangeDecision;
  comments?: string;
  conditions: Record<string, unknown>;
  decidedAt: string;
}

export interface ChangeRollback {
  id: string;
  changeId: string;
  reason: string;
  rollbackType: RollbackType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  stepsCompleted: string[];
  initiatedBy?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ChangeManagementStats {
  totalRequests: number;
  pendingApprovals: number;
  completedThisWeek: number;
  rollbackRate: number;
  avgApprovalTime: number;
  byType: Array<{ type: ChangeRequestType; count: number }>;
}
