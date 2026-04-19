export type SecretType = 'generic' | 'api_key' | 'password' | 'certificate' | 'ssh_key' | 'token';
export type SecretAction = 'read' | 'write' | 'rotate' | 'delete' | 'list';

export interface SecretManagerConfig {
  id: string;
  agentId: string;
  encryptionAlgorithm: string;
  keyRotationDays: number;
  autoRotate: boolean;
  auditAccess: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSecret {
  id: string;
  configId: string;
  name: string;
  secretType: SecretType;
  encryptedValue: string;
  version: number;
  expiresAt?: Date;
  lastRotatedAt?: Date;
  lastAccessedAt?: Date;
  createdAt: Date;
}

export interface SecretAccessLog {
  id: string;
  secretId: string;
  accessorId: string;
  action: SecretAction;
  ipAddress?: string;
  success: boolean;
  createdAt: Date;
}
