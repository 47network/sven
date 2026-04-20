export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305' | 'rsa-oaep' | 'ecdh-p256';
export type KeyStatus = 'active' | 'rotated' | 'expired' | 'compromised' | 'destroyed';
export type KeyPurpose = 'encryption' | 'signing' | 'key_wrapping' | 'authentication';
export type DataType = 'secret' | 'config' | 'credential' | 'document' | 'backup';

export interface EncryptionManagerConfig {
  id: string;
  agentId: string;
  defaultAlgorithm: EncryptionAlgorithm;
  keyRotationDays: number;
  envelopeEncryption: boolean;
  hsmEnabled: boolean;
  backupKeys: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptionKey {
  id: string;
  configId: string;
  agentId: string;
  keyAlias: string;
  algorithm: EncryptionAlgorithm;
  keyVersion: number;
  status: KeyStatus;
  purpose: KeyPurpose;
  expiresAt: Date | null;
  rotatedFrom: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface EncryptedDataRegistry {
  id: string;
  keyId: string;
  dataReference: string;
  dataType: DataType;
  encryptionContext: Record<string, unknown>;
  encryptedAt: Date;
  createdAt: Date;
}
