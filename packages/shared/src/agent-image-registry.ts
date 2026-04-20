export type AuthMethod = 'token' | 'basic' | 'oidc' | 'none';
export type RepoVisibility = 'public' | 'private' | 'internal';

export interface AgentImageRegConfig {
  id: string;
  agent_id: string;
  registry_url: string;
  auth_method: AuthMethod;
  storage_backend: string;
  retention_days: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentRegistryRepo {
  id: string;
  config_id: string;
  repo_name: string;
  visibility: RepoVisibility;
  tag_count: number;
  total_size_bytes: number;
  last_pushed_at?: string;
  created_at: string;
}

export interface AgentRegistryTag {
  id: string;
  repo_id: string;
  tag_name: string;
  digest: string;
  size_bytes: number;
  architecture: string;
  os: string;
  pushed_at: string;
  created_at: string;
}
