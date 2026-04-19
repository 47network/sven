// Batch 177: Agent Certificate Manager types

export type CertificateType = 'tls_server' | 'tls_client' | 'code_signing' | 's_mime' | 'ca_intermediate' | 'self_signed' | 'wildcard' | 'san';
export type CertKeyAlgorithm = 'rsa2048' | 'rsa4096' | 'ec256' | 'ec384' | 'ed25519';
export type CertificateStatus = 'active' | 'expiring' | 'expired' | 'revoked' | 'pending' | 'renewal_failed';
export type CertRenewalType = 'auto_acme' | 'manual' | 'csr_request' | 'self_sign' | 'ca_signed';
export type CertRenewalStatus = 'pending' | 'requesting' | 'validating' | 'issued' | 'failed' | 'cancelled';
export type CertChallengeType = 'http01' | 'dns01' | 'tls_alpn01';
export type CertCheckType = 'expiry' | 'revocation' | 'chain_validity' | 'key_strength' | 'ct_log' | 'transparency';
export type CertMonitorStatus = 'healthy' | 'warning' | 'critical' | 'unknown' | 'error';

export interface CertificateInventory {
  id: string;
  agentId: string;
  certName: string;
  domain: string;
  certType: CertificateType;
  issuer: string;
  serialNumber: string;
  fingerprintSha256: string;
  subjectCn: string;
  sanDomains: string[];
  keyAlgorithm: CertKeyAlgorithm;
  issuedAt: string;
  expiresAt: string;
  autoRenew: boolean;
  renewDaysBefore: number;
  status: CertificateStatus;
  privateKeyRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateRenewal {
  id: string;
  certId: string;
  renewalType: CertRenewalType;
  status: CertRenewalStatus;
  acmeProvider: string | null;
  challengeType: CertChallengeType | null;
  oldSerial: string | null;
  newSerial: string | null;
  requestedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface CertificateMonitor {
  id: string;
  certId: string;
  checkType: CertCheckType;
  lastCheckAt: string | null;
  nextCheckAt: string;
  checkIntervalHours: number;
  lastStatus: CertMonitorStatus;
  alertSent: boolean;
  findings: Record<string, unknown>;
  createdAt: string;
}
