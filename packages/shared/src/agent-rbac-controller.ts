export type PrincipalType = 'agent' | 'user' | 'service' | 'group';
export type Permission = 'read' | 'write' | 'execute' | 'admin' | 'delete' | 'approve';
export interface AgentRbacConfig {
  id: string; agent_id: string; default_role: string; enforce_mfa: boolean;
  session_timeout_minutes: number; status: string; created_at: string; updated_at: string;
}
export interface AgentRbacRole {
  id: string; config_id: string; role_name: string; permissions: Permission[];
  inherits_from: string | null; description: string; created_at: string;
}
export interface AgentRbacAssignment {
  id: string; role_id: string; principal_type: PrincipalType; principal_id: string;
  granted_by: string; expires_at: string | null; created_at: string;
}
