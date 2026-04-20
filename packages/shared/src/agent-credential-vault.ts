export type CredentialType = 'password' | 'api_key' | 'certificate' | 'ssh_key' | 'oauth_token' | 'service_account';
export type AuditAction = 'created' | 'read' | 'updated' | 'rotated' | 'deleted' | 'accessed';

export interface CredentialVaultConfig {
  id: string;
  agentId: string;
  encryptionAlgorithm: string;
  autoRotateDays: number;
  maxVersions: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCredential {
  id: string;
  configId: string;
  name: string;
  credentialType: CredentialType;
  version: number;
  expiresAt?: string;
  lastRotatedAt?: string;
  createdAt: string;
}

export interface CredentialAuditEntry {
  id: string;
  credentialId: string;
  action: AuditAction;
  actor: string;
  ipAddress?: string;
  performedAt: string;
}
