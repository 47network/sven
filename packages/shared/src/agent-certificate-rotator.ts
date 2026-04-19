export type RotationStrategy = 'automatic' | 'manual' | 'scheduled' | 'on_demand';
export type CertAuthority = 'lets_encrypt' | 'digicert' | 'comodo' | 'self_signed' | 'custom';
export type CertKeyType = 'ecdsa_p256' | 'ecdsa_p384' | 'rsa_2048' | 'rsa_4096' | 'ed25519';
export type CertStatus = 'active' | 'expiring' | 'expired' | 'revoked' | 'pending';

export interface CertificateRotatorConfig {
  id: string;
  agentId: string;
  rotationStrategy: RotationStrategy;
  renewalDaysBefore: number;
  certAuthority: CertAuthority;
  keyType: CertKeyType;
  backupEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Certificate {
  id: string;
  configId: string;
  agentId: string;
  domain: string;
  certType: string;
  issuer: string | null;
  serialNumber: string | null;
  fingerprint: string | null;
  issuedAt: Date | null;
  expiresAt: Date;
  status: CertStatus;
  autoRenew: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CertRotationLog {
  id: string;
  certId: string;
  rotationType: string;
  oldFingerprint: string | null;
  newFingerprint: string | null;
  status: string;
  errorMessage: string | null;
  rotatedAt: Date;
  createdAt: Date;
}
