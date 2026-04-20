export type SslCertificateStatus = 'pending' | 'issued' | 'active' | 'expiring' | 'expired' | 'revoked';
export type SslCertificateType = 'dv' | 'ov' | 'ev' | 'wildcard' | 'san';
export type SslRenewalStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type SslAuditGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type SslIssuer = 'letsencrypt' | 'zerossl' | 'digicert' | 'comodo' | 'globalsign' | 'self_signed';
export type SslProtocol = 'tls_1_0' | 'tls_1_1' | 'tls_1_2' | 'tls_1_3';

export interface AgentSslCertificate {
  id: string;
  agentId: string;
  domain: string;
  issuer: SslIssuer;
  status: SslCertificateStatus;
  certificateType: SslCertificateType;
  issuedAt?: string;
  expiresAt?: string;
  autoRenew: boolean;
  metadata: Record<string, unknown>;
}

export interface AgentSslRenewal {
  id: string;
  certificateId: string;
  status: SslRenewalStatus;
  initiatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface AgentSslAudit {
  id: string;
  agentId: string;
  domain: string;
  grade?: SslAuditGrade;
  vulnerabilities: string[];
  protocolSupport: Record<string, boolean>;
  cipherSuites: string[];
  auditedAt: string;
}
