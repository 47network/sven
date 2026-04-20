/* Batch 134 — Agent Audit Trail types */

export type AuditTrailAction = 'create' | 'update' | 'delete' | 'access' | 'execute' | 'approve' | 'reject' | 'escalate';
export type AuditTrailScope = 'agent' | 'service' | 'task' | 'config' | 'deployment' | 'user' | 'system';
export type AuditSnapshotType = 'full' | 'incremental' | 'diff';

export interface TrailEntry {
  id: string;
  action: AuditTrailAction;
  scope: AuditTrailScope;
  actorId?: string;
  actorType: string;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditSnapshot {
  id: string;
  snapshotType: AuditSnapshotType;
  scope: string;
  data: Record<string, unknown>;
  entryCount: number;
  compressed: boolean;
  createdAt: string;
}

export interface AuditRetentionPolicy {
  id: string;
  name: string;
  scope: string;
  retentionDays: number;
  archiveAfter: number;
  compressAfter: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditTrailStats {
  totalEntries: number;
  entriesToday: number;
  topActions: Array<{ action: AuditTrailAction; count: number }>;
  topScopes: Array<{ scope: AuditTrailScope; count: number }>;
  snapshotCount: number;
  retentionPolicies: number;
}
