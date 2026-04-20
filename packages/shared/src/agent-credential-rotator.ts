export type CredentialType = 'api_key' | 'password' | 'certificate' | 'oauth_token' | 'ssh_key' | 'jwt_secret';
export type CredentialState = 'active' | 'rotating' | 'expired' | 'revoked';
export interface AgentCredRotConfig {
  id: string; agent_id: string; rotation_interval_days: number; auto_rotate: boolean;
  vault_type: string; notification_channels: string[]; status: string; created_at: string; updated_at: string;
}
export interface AgentCredential {
  id: string; config_id: string; credential_name: string; credential_type: CredentialType;
  last_rotated_at: string | null; next_rotation_at: string | null; rotation_count: number;
  state: CredentialState; created_at: string;
}
export interface AgentRotationLog {
  id: string; credential_id: string; rotated_by: string; success: boolean;
  error: string | null; old_expiry: string | null; new_expiry: string | null; rotated_at: string;
}
