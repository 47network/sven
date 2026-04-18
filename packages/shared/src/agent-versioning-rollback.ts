/* Batch 63 — Agent Versioning & Rollback */

export type SnapshotType = 'full' | 'config' | 'skills' | 'memory' | 'state';
export type RollbackType = 'manual' | 'automatic' | 'health_check' | 'performance' | 'error_rate';
export type RollbackStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type DeploymentSlot = 'production' | 'staging' | 'canary' | 'preview' | 'rollback';
export type VersionDiffType = 'config' | 'skills' | 'memory' | 'behavior' | 'full';
export type VersioningAction = 'version_create' | 'snapshot_take' | 'rollback_initiate' | 'slot_assign' | 'diff_generate' | 'version_promote' | 'rollback_cancel';

export const SNAPSHOT_TYPES: SnapshotType[] = ['full', 'config', 'skills', 'memory', 'state'];
export const ROLLBACK_TYPES: RollbackType[] = ['manual', 'automatic', 'health_check', 'performance', 'error_rate'];
export const ROLLBACK_STATUSES: RollbackStatus[] = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'];
export const DEPLOYMENT_SLOTS: DeploymentSlot[] = ['production', 'staging', 'canary', 'preview', 'rollback'];
export const VERSION_DIFF_TYPES: VersionDiffType[] = ['config', 'skills', 'memory', 'behavior', 'full'];
export const VERSIONING_ACTIONS: VersioningAction[] = ['version_create', 'snapshot_take', 'rollback_initiate', 'slot_assign', 'diff_generate', 'version_promote', 'rollback_cancel'];

export interface AgentVersion {
  id: string;
  agentId: string;
  versionTag: string;
  major: number;
  minor: number;
  patch: number;
  changelog?: string;
  snapshotData: Record<string, unknown>;
  configHash?: string;
  isCurrent: boolean;
  isStable: boolean;
  createdBy?: string;
  createdAt: string;
  promotedAt?: string;
}

export interface AgentSnapshot {
  id: string;
  versionId: string;
  agentId: string;
  snapshotType: SnapshotType;
  data: Record<string, unknown>;
  sizeBytes: number;
  compressed: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface AgentRollback {
  id: string;
  agentId: string;
  fromVersionId: string;
  toVersionId: string;
  reason?: string;
  rollbackType: RollbackType;
  status: RollbackStatus;
  startedAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentDeploymentSlot {
  id: string;
  agentId: string;
  slotName: DeploymentSlot;
  versionId?: string;
  trafficPct: number;
  isActive: boolean;
  promotedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentVersionDiff {
  id: string;
  agentId: string;
  fromVersionId: string;
  toVersionId: string;
  diffType: VersionDiffType;
  additions: unknown[];
  removals: unknown[];
  modifications: unknown[];
  summary?: string;
  createdAt: string;
}

export function formatVersionTag(major: number, minor: number, patch: number): string {
  return `v${major}.${minor}.${patch}`;
}

export function isRollbackTerminal(status: RollbackStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function canPromoteSlot(slot: AgentDeploymentSlot): boolean {
  return slot.isActive && slot.slotName !== 'production' && !!slot.versionId;
}

export function calculateTrafficSplit(slots: AgentDeploymentSlot[]): number {
  return slots.filter(s => s.isActive).reduce((sum, s) => sum + s.trafficPct, 0);
}
