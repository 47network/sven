export type CertIssuer = 'letsencrypt' | 'zerossl' | 'digicert' | 'self_signed' | 'custom';
export type CertStatus = 'pending' | 'issued' | 'expired' | 'revoked' | 'failed';
export type CertType = 'dv' | 'ov' | 'ev' | 'self_signed' | 'wildcard';
export type ChallengeType = 'http01' | 'dns01' | 'tls_alpn01';
export type CertDeploymentStatus = 'active' | 'pending' | 'failed' | 'replaced';

export interface TlsCertificate {
  id: string;
  agentId: string;
  domain: string;
  issuer: CertIssuer;
  status: CertStatus;
  certType: CertType;
  notBefore: string | null;
  notAfter: string | null;
  autoRenew: boolean;
  keyAlgorithm: string;
  fingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertChallenge {
  id: string;
  certId: string;
  challengeType: ChallengeType;
  token: string;
  keyAuthorization: string | null;
  status: string;
  validatedAt: string | null;
  createdAt: string;
}

export interface CertDeployment {
  id: string;
  certId: string;
  targetService: string;
  deployedAt: string;
  status: CertDeploymentStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TlsCertificateStats {
  totalCerts: number;
  activeCerts: number;
  expiringSoon: number;
  autoRenewEnabled: number;
  deploymentCount: number;
}
