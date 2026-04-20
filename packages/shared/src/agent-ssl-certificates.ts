// Batch 100 — Agent SSL Certificates shared types

export type SslCertType = 'dv' | 'ov' | 'ev' | 'self_signed' | 'wildcard';

export type SslCertStatus = 'pending' | 'issued' | 'active' | 'expiring' | 'expired' | 'revoked' | 'failed';

export type SslRenewalType = 'automatic' | 'manual' | 'forced';

export type SslAlertType = 'expiry_warning' | 'expiry_critical' | 'renewal_failed' | 'revoked' | 'chain_invalid';

export interface SslCertificate {
  id: string;
  agentId: string;
  domain: string;
  issuer: string;
  certType: SslCertType;
  fingerprint: string | null;
  serialNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  status: SslCertStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SslRenewalEntry {
  id: string;
  certId: string;
  renewalType: SslRenewalType;
  oldFingerprint: string | null;
  newFingerprint: string | null;
  oldExpiry: string | null;
  newExpiry: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface SslAlert {
  id: string;
  certId: string;
  alertType: SslAlertType;
  daysUntilExpiry: number | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  createdAt: string;
}

export interface SslCertStats {
  totalCerts: number;
  activeCerts: number;
  expiringWithin30Days: number;
  expiredCerts: number;
  autoRenewEnabled: number;
  renewalSuccessRate: number;
}
