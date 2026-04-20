/* Batch 64 — Agent Secrets & Credentials Management */

export type SecretType = 'api_key' | 'token' | 'password' | 'certificate' | 'ssh_key' | 'webhook_secret';
export type SecretScope = 'agent' | 'crew' | 'global' | 'service' | 'environment';
export type RotationType = 'manual' | 'scheduled' | 'forced' | 'expired' | 'compromised';
export type RotationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type AccessType = 'read' | 'write' | 'rotate' | 'revoke' | 'list' | 'export';
export type ShareType = 'read' | 'use' | 'rotate' | 'admin';
export type SecretsAction = 'secret_store' | 'secret_retrieve' | 'secret_rotate' | 'secret_revoke' | 'secret_share' | 'policy_create' | 'audit_query';

export const SECRET_TYPES: SecretType[] = ['api_key', 'token', 'password', 'certificate', 'ssh_key', 'webhook_secret'];
export const SECRET_SCOPES: SecretScope[] = ['agent', 'crew', 'global', 'service', 'environment'];
export const ROTATION_TYPES: RotationType[] = ['manual', 'scheduled', 'forced', 'expired', 'compromised'];
export const ACCESS_TYPES: AccessType[] = ['read', 'write', 'rotate', 'revoke', 'list', 'export'];
export const SHARE_TYPES: ShareType[] = ['read', 'use', 'rotate', 'admin'];
export const SECRETS_ACTIONS: SecretsAction[] = ['secret_store', 'secret_retrieve', 'secret_rotate', 'secret_revoke', 'secret_share', 'policy_create', 'audit_query'];

export interface AgentSecret {
  id: string;
  agentId: string;
  secretName: string;
  secretType: SecretType;
  encryptedValue: string;
  encryptionAlgo: string;
  keyVersion: number;
  scope: SecretScope;
  isActive: boolean;
  expiresAt?: string;
  lastRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretRotation {
  id: string;
  secretId: string;
  rotationType: RotationType;
  oldKeyVersion: number;
  newKeyVersion: number;
  rotatedBy?: string;
  status: RotationStatus;
  startedAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SecretAccessLog {
  id: string;
  secretId: string;
  accessedBy: string;
  accessType: AccessType;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  createdAt: string;
}

export interface SecretPolicy {
  id: string;
  policyName: string;
  secretType: string;
  maxAgeDays: number;
  rotationDays: number;
  minLength: number;
  requireRotation: boolean;
  notifyBeforeDays: number;
  autoRotate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SecretShare {
  id: string;
  secretId: string;
  sharedWith: string;
  shareType: ShareType;
  grantedBy: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
  createdAt: string;
}

export function isSecretExpired(secret: AgentSecret): boolean {
  if (!secret.expiresAt) return false;
  return new Date(secret.expiresAt) < new Date();
}

export function needsRotation(secret: AgentSecret, maxAgeDays: number): boolean {
  if (!secret.lastRotatedAt) return true;
  const age = Date.now() - new Date(secret.lastRotatedAt).getTime();
  return age > maxAgeDays * 86400000;
}

export function isShareActive(share: SecretShare): boolean {
  if (!share.isActive) return false;
  if (share.revokedAt) return false;
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return false;
  return true;
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}
