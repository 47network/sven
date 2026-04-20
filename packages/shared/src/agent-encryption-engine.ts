export type KeyDerivation = 'pbkdf2' | 'scrypt' | 'argon2' | 'hkdf';
export type KeyPurpose = 'encrypt' | 'sign' | 'wrap' | 'derive';
export type KeyStatus = 'active' | 'rotated' | 'revoked' | 'expired';
export type EncryptionOperation = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'hash';

export interface EncryptionEngineConfig {
  id: string;
  agentId: string;
  defaultAlgorithm: string;
  keyDerivation: KeyDerivation;
  keyLength: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptionKey {
  id: string;
  configId: string;
  name: string;
  algorithm: string;
  keyMaterial: string;
  purpose: KeyPurpose;
  status: KeyStatus;
  expiresAt?: Date;
  createdAt: Date;
}

export interface EncryptionOperationLog {
  id: string;
  configId: string;
  keyId?: string;
  operation: EncryptionOperation;
  algorithm: string;
  inputSize?: number;
  outputSize?: number;
  durationMs?: number;
  success: boolean;
  createdAt: Date;
}
