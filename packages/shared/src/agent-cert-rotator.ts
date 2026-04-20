export type CertStatus = 'active' | 'expiring' | 'expired' | 'revoked' | 'pending';
export type CertIssuer = 'letsencrypt' | 'zerossl' | 'buypass' | 'self_signed' | 'custom';
export type RotationAction = 'issued' | 'renewed' | 'revoked' | 'expired' | 'check';

export interface CertRotatorConfig {
  id: string;
  agentId: string;
  checkIntervalHours: number;
  renewalThresholdDays: number;
  autoRenew: boolean;
  notificationChannels: string[];
  metadata: Record<string, unknown>;
}

export interface Certificate {
  id: string;
  configId: string;
  domain: string;
  issuer: CertIssuer;
  serialNumber: string | null;
  issuedAt: string | null;
  expiresAt: string;
  status: CertStatus;
}

export interface CertRotationLog {
  id: string;
  certId: string;
  action: RotationAction;
  oldSerial: string | null;
  newSerial: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}
