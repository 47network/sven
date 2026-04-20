export type KeyAlgorithm = 'aes-256-gcm' | 'rsa-4096' | 'ed25519' | 'x25519' | 'chacha20';
export type KeyType = 'symmetric' | 'asymmetric' | 'signing' | 'exchange';
export type KeyStatus = 'active' | 'rotated' | 'revoked' | 'expired';
export type KeyOperation = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'wrap' | 'unwrap';

export interface AgentEncryptionKey {
  id: string;
  agentId: string;
  keyAlias: string;
  algorithm: KeyAlgorithm;
  keyType: KeyType;
  status: KeyStatus;
  expiresAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentKeyRotation {
  id: string;
  keyId: string;
  oldVersion: number;
  newVersion: number;
  reason?: string;
  rotatedBy?: string;
  createdAt: string;
}

export interface AgentKeyUsageLog {
  id: string;
  keyId: string;
  operation: KeyOperation;
  requesterId?: string;
  success: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}
