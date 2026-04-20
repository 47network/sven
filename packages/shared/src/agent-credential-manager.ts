/* Batch 188 — Credential Manager shared types */

export type CredentialStoreType = 'vault' | 'keychain' | 'env_vars' | 'config_file' | 'kms' | 'hsm';
export type CredentialStoreStatus = 'active' | 'locked' | 'rotating' | 'archived' | 'compromised';
export type CredentialType = 'api_key' | 'password' | 'token' | 'certificate' | 'ssh_key' | 'oauth' | 'service_account';
export type CredentialStatus = 'active' | 'expired' | 'revoked' | 'rotating' | 'pending';
export type CredentialAuditAction = 'created' | 'accessed' | 'rotated' | 'revoked' | 'expired' | 'leaked' | 'recovered';
export type CredentialRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CredentialStore {
  id: string;
  agent_id: string;
  name: string;
  store_type: CredentialStoreType;
  provider?: string;
  status: CredentialStoreStatus;
  encryption_algorithm: string;
  credential_count: number;
  last_audit_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentCredential {
  id: string;
  store_id: string;
  name: string;
  credential_type: CredentialType;
  status: CredentialStatus;
  expires_at?: string;
  last_rotated_at?: string;
  rotation_interval_days?: number;
  access_count: number;
  last_accessed_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CredentialAudit {
  id: string;
  credential_id: string;
  action: CredentialAuditAction;
  actor_agent_id?: string;
  ip_address?: string;
  details: Record<string, unknown>;
  risk_level: CredentialRiskLevel;
  created_at: string;
}
