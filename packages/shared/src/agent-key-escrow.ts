export type KeyType = 'symmetric' | 'asymmetric' | 'signing' | 'encryption' | 'api';
export type KeyStatus = 'active' | 'rotated' | 'revoked' | 'archived';
export type KeyAccessAction = 'read' | 'create' | 'rotate' | 'revoke' | 'backup' | 'restore';

export interface KeyEscrowConfig {
  id: string;
  agentId: string;
  encryptionAlgorithm: string;
  keyRotationDays: number;
  backupEnabled: boolean;
  metadata: Record<string, unknown>;
}

export interface EscrowedKey {
  id: string;
  configId: string;
  keyAlias: string;
  keyType: KeyType;
  encryptedKeyData: string;
  version: number;
  status: KeyStatus;
  expiresAt: string | null;
}

export interface KeyAccessLog {
  id: string;
  keyId: string;
  accessorAgentId: string;
  action: KeyAccessAction;
  ipAddress: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}
