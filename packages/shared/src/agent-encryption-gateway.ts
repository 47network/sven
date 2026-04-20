export type EncryptionType = 'aes256' | 'rsa4096' | 'chacha20' | 'tls13' | 'e2e';
export type EncryptionOperationType = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'seal' | 'unseal';
export type CertificateType = 'root_ca' | 'intermediate' | 'leaf' | 'self_signed' | 'client';
export type CertificateStatus = 'valid' | 'expired' | 'revoked' | 'pending';

export interface AgentEncryptionChannel {
  id: string;
  agentId: string;
  channelName: string;
  encryptionType: EncryptionType;
  status: 'active' | 'suspended' | 'revoked';
  endpointA: string;
  endpointB: string;
  keyExchangeMethod: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AgentEncryptionOperation {
  id: string;
  channelId?: string;
  agentId: string;
  operationType: EncryptionOperationType;
  dataSizeBytes: number;
  algorithm: string;
  durationMs?: number;
  status: 'pending' | 'completed' | 'failed';
  performedAt: Date;
}

export interface AgentCertificateEntry {
  id: string;
  agentId: string;
  certType: CertificateType;
  subject: string;
  issuer?: string;
  serialNumber?: string;
  validFrom: Date;
  validUntil: Date;
  fingerprint: string;
  status: CertificateStatus;
  createdAt: Date;
}
