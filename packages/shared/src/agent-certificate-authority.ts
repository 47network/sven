// Batch 238: Certificate Authority types

export type CertificateType = 'ssl_tls' | 'code_signing' | 'client_auth' | 'email' | 'wildcard';
export type CertificateStatus = 'active' | 'expired' | 'revoked' | 'pending';
export type CertAuditAction = 'issued' | 'renewed' | 'revoked' | 'verified' | 'expired' | 'rotated';
export type KeyAlgorithm = 'rsa_2048' | 'rsa_4096' | 'ecdsa_p256' | 'ecdsa_p384' | 'ed25519';

export interface AgentCertificateConfig {
  id: string;
  agentId: string;
  domain: string;
  certType: CertificateType;
  issuer: string;
  validityDays: number;
  keyAlgorithm: KeyAlgorithm;
  autoRenew: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIssuedCertificate {
  id: string;
  configId: string;
  serialNumber: string;
  subject: string;
  san: string[];
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  fingerprint: string;
  status: CertificateStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentCertificateAudit {
  id: string;
  certificateId: string;
  action: CertAuditAction;
  performedBy: string;
  details: Record<string, unknown>;
  createdAt: string;
}
