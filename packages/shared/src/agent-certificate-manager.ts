/* Batch 189 — Certificate Manager shared types */

export type CertificateAuthorityType = 'root' | 'intermediate' | 'external' | 'acme' | 'self_signed';
export type CertificateAuthorityStatus = 'active' | 'expired' | 'revoked' | 'pending' | 'suspended';
export type CertificateKeyAlgorithm = 'rsa-2048' | 'rsa-4096' | 'ecdsa-256' | 'ecdsa-384' | 'ed25519';
export type CertificateType = 'server' | 'client' | 'wildcard' | 'code_signing' | 'email' | 'mutual_tls';
export type CertificateStatus = 'active' | 'expired' | 'revoked' | 'pending_renewal' | 'suspended';
export type CertificateRenewalType = 'auto' | 'manual' | 'emergency' | 'upgrade' | 'reissue';
export type CertificateRenewalStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface CertificateAuthority {
  id: string;
  agent_id: string;
  name: string;
  ca_type: CertificateAuthorityType;
  status: CertificateAuthorityStatus;
  issuer?: string;
  valid_from?: string;
  valid_until?: string;
  key_algorithm: CertificateKeyAlgorithm;
  certificates_issued: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentCertificate {
  id: string;
  ca_id: string;
  common_name: string;
  cert_type: CertificateType;
  status: CertificateStatus;
  serial_number?: string;
  valid_from?: string;
  valid_until?: string;
  auto_renew: boolean;
  renewal_days_before: number;
  domain_names: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CertificateRenewal {
  id: string;
  certificate_id: string;
  old_serial?: string;
  new_serial?: string;
  renewal_type: CertificateRenewalType;
  status: CertificateRenewalStatus;
  initiated_by?: string;
  completed_at?: string;
  error_message?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
