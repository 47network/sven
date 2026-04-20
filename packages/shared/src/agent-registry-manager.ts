export type RegistryType = 'docker' | 'oci' | 'helm' | 'npm' | 'pypi' | 'maven';
export type RepoVisibility = 'public' | 'private' | 'internal';

export interface AgentRegMgrConfig {
  id: string; agent_id: string; registry_type: RegistryType; registry_url: string;
  auth_ref: string; retention_days: number; max_size_gb: number;
  status: string; created_at: string; updated_at: string;
}
export interface AgentRegRepository {
  id: string; config_id: string; repo_name: string; visibility: RepoVisibility;
  tag_count: number; total_size_mb: number; last_push_at: string; created_at: string;
}
export interface AgentRegTag {
  id: string; repo_id: string; tag: string; digest: string;
  size_mb: number; architecture: string; pushed_at: string; expires_at: string | null;
}
